import vcjs from 'vc-js';
import { blake2AsHex } from '@polkadot/util-crypto';
import { validate } from 'jsonschema';

import documentLoader from './vc/document-loader';
import { isHexWithGivenByteSize } from './codec';
import { RevEntryByteSize, RevRegIdByteSize } from './revocation';

import {
  EcdsaSecp256k1VerKeyName, Ed25519VerKeyName, Sr25519VerKeyName, EcdsaSepc256k1Signature2019, Ed25519Signature2018, Sr25519Signature2020,
} from './vc/custom_crypto';

import DIDResolver from '../did-resolver'; // eslint-disable-line
import Schema from '../modules/schema';
/**
 * @typedef {object} VerifiablePresentation Representation of a Verifiable Presentation.
 */

// XXX: Does it make sense to have a revocation registry type for Dock like below and eliminate the need for `rev_reg:dock:`?
// export const RevRegType = 'DockRevocationRegistry2020';
export const RevRegType = 'CredentialStatusList2017';
export const DockRevRegQualifier = 'rev-reg:dock:';

// const {Ed25519Signature2018} = suites;

/**
* @typedef {object} VerifiableParams The Options to verify credentials and presentations.
* @property {string} [challenge] - proof challenge Required.
* @property {string} [domain] - proof domain (optional)
* @property {DIDResolver} [resolver] - Resolver to resolve the issuer DID (optional)
* @property {Boolean} [compactProof] - Whether to compact the JSON-LD or not.
* @property {Boolean} [forceRevocationCheck] - Whether to force revocation check or not.
* Warning, setting forceRevocationCheck to false can allow false positives when verifying revocable credentials.
* @property {object} [revocationApi] - An object representing a map. "revocation type -> revocation API". The API is used to check
* revocation status. For now, the object specifies the type as key and the value as the API, but the structure can change
* as we support more APIs there are more details associated with each API. Only Dock is supported as of now.
* @property {object} [schemaApi] - An object representing a map. "schema type -> schema API". The API is used to get
* a schema doc. For now, the object specifies the type as key and the value as the API, but the structure can change
* as we support more APIs there are more details associated with each API. Only Dock is supported as of now.
*/

/**
 * Get signature suite from a keyDoc
 * @param {object} keyDoc - key document containing `id`, `controller`, `type`, `privateKeyBase58` and `publicKeyBase58`
 * @returns {EcdsaSepc256k1Signature2019|Ed25519Signature2018|Sr25519Signature2020} - signature suite.
 */
export function getSuiteFromKeyDoc(keyDoc) {
  let Cls;
  switch (keyDoc.type) {
    case EcdsaSecp256k1VerKeyName:
      Cls = EcdsaSepc256k1Signature2019;
      break;
    case Ed25519VerKeyName:
      Cls = Ed25519Signature2018;
      break;
    case Sr25519VerKeyName:
      Cls = Sr25519Signature2020;
      break;
    default:
      throw new Error(`Unknown key type ${keyDoc.type}.`);
  }
  return new Cls({
    ...keyDoc,
    verificationMethod: keyDoc.id,
  });
}

/**
 * Check if credential has Dock specific revocation
 * @param credential
 * @returns {Boolean}
 */
export function hasDockRevocation(credential) {
  return credential.credentialStatus
    && (credential.credentialStatus.type === RevRegType)
    && credential.credentialStatus.id.startsWith(DockRevRegQualifier)
    && isHexWithGivenByteSize(credential.credentialStatus.id.slice(DockRevRegQualifier.length), RevRegIdByteSize);
}

/**
 * Checks if the revocation check is needed. Will return true if `forceRevocationCheck` is true else will check the
 * truthyness of revocationApi. Will return true even if revocationApi is an empty object.
 * @param {object} credStatus - The `credentialStatus` field in a credential. Does not care about the correct
 * structure of this field but only the truthyness of this field. The intention is to check whether the credential h
 * had a `credentialStatus` field.
 * @param {boolean} forceRevocationCheck - Whether to force the revocation check.
 * Warning, setting forceRevocationCheck to false can allow false positives when verifying revocable credentials.
 * @param {object} revocationApi - See above verification methods for details on this parameter
 * @returns {boolean} - Whether to check for revocation or not.
 */
export function isRevocationCheckNeeded(credStatus, forceRevocationCheck, revocationApi) {
  return !!credStatus && (forceRevocationCheck || !!revocationApi);
}

/**
 * Generate the revocation id of a credential usable by Dock. It hashes the credential id to get the
 * revocation id
 * @param credential
 * @returns {*}
 */
export function getDockRevIdFromCredential(credential) {
  // The hash outputs the same number of bytes as required by Dock
  return blake2AsHex(credential.id, RevEntryByteSize * 8);
}

/**
 * Check if the credential is revoked or not.
 * @param credential
 * @param revocationApi
 * @returns {Promise<{verified: boolean}|{verified: boolean, error: string}>} The returned object will have a key `verified`
 * which is true if the credential is not revoked and false otherwise. The `error` will describe the error if any.
 */
export async function checkRevocationStatus(credential, revocationApi) {
  if (!revocationApi.dock) {
    throw new Error('Only Dock revocation support is present as of now.');
  } else {
    if (!hasDockRevocation(credential)) {
      return { verified: false, error: 'The credential status does not have the format required by Dock' };
    }
    const dockAPI = revocationApi.dock;
    const regId = credential.credentialStatus.id.slice(DockRevRegQualifier.length);
    // Hash credential id to get revocation id
    const revId = getDockRevIdFromCredential(credential);
    const revocationStatus = await dockAPI.revocation.getIsRevoked(regId, revId);
    if (revocationStatus) {
      return { verified: false, error: 'Revocation check failed' };
    }
    return { verified: true };
  }
}

/**
 * Issue a Verifiable credential
 * @param {object} keyDoc - key document containing `id`, `controller`, `type`, `privateKeyBase58` and `publicKeyBase58`
 * @param {object} credential - Credential to be signed.
 * @param {Boolean} compactProof - Whether to compact the JSON-LD or not.
 * @return {Promise<object>} The signed credential object.
 */
export async function issueCredential(keyDoc, credential, compactProof = true) {
  const suite = getSuiteFromKeyDoc(keyDoc);
  // The following code (including `issue` method) will modify the passed credential so clone it.gb
  const cred = { ...credential };
  cred.issuer = keyDoc.controller;
  return vcjs.issue({
    suite,
    credential: cred,
    documentLoader: documentLoader(),
    compactProof,
  });
}

/**
 * Verify a Verifiable Credential. Returns the verification status and error in an object
 * @param {object} [credential] The VCDM Credential
 * @param {VerifiableParams} Verify parameters
 * @return {Promise<object>} verification result. The returned object will have a key `verified` which is true if the
 * credential is valid and not revoked and false otherwise. The `error` will describe the error if any.
 */
export async function verifyCredential(credential, {
  resolver = null, compactProof = true, forceRevocationCheck = true, revocationApi = null, schemaApi = null,
} = {}) {
  await getAndValidateSchemaIfPresent(credential, schemaApi);

  // Run VCJS verifier
  const credVer = await vcjs.verifyCredential({
    credential,
    suite: [new Ed25519Signature2018(), new EcdsaSepc256k1Signature2019(), new Sr25519Signature2020()],
    documentLoader: documentLoader(resolver),
    compactProof,
  });

  // Check for revocation only if the credential is verified and revocation check is needed.
  if (credVer.verified && isRevocationCheckNeeded(credential.credentialStatus, forceRevocationCheck, revocationApi)) {
    const revResult = await checkRevocationStatus(credential, revocationApi);
    // If revocation check fails, return the error else return the result of credential verification to avoid data loss.
    if (!revResult.verified) {
      return revResult;
    }
  }
  return credVer;
}

/**
 * Check that credential is verified, i.e. the credential has VCDM compliant structure and the `proof`
 * (signature by issuer) is correct.
 * @param {object} [credential] The credential to verify
 * @param {object} [params] Verify parameters (TODO: add type info for this object)
 * @returns {Promise<boolean>} Returns promise that resolves to true if credential is valid and not revoked and false otherwise
 */
export async function isVerifiedCredential(credential, params) {
  const result = await verifyCredential(credential, params);
  return result.verified;
}

/**
 * Create an unsigned Verifiable Presentation
 * @param {object|Array<object>} verifiableCredential - verifiable credential (or an array of them) to be bundled as a presentation.
 * @param {string} id - optional verifiable presentation id to use
 * @param {string} [holder] - optional presentation holder url
 * @return {object} verifiable presentation.
 */
export function createPresentation(verifiableCredential, id, holder = null) {
  return vcjs.createPresentation({
    verifiableCredential,
    id,
    holder,
  });
}

/**
 * Sign a Verifiable Presentation
 * @param {object} presentation - the one to be signed
 * @param {object} keyDoc - key document containing `id`, `controller`, `type`, `privateKeyBase58` and `publicKeyBase58`
 * @param {string} challenge - proof challenge Required.
 * @param {string} domain - proof domain (optional)
 * @param {DIDResolver} [resolver] - Resolver for DIDs.
 * @param {Boolean} [compactProof] - Whether to compact the JSON-LD or not.
 * @return {Promise<VerifiablePresentation>} A VerifiablePresentation with a proof.
 */
export async function signPresentation(presentation, keyDoc, challenge, domain, resolver = null, compactProof = true) {
  // TODO: support other purposes than the default of "authentication"
  const suite = getSuiteFromKeyDoc(keyDoc);
  return vcjs.signPresentation({
    presentation,
    suite,
    domain,
    challenge,
    compactProof,
    documentLoader: documentLoader(resolver),
  });
}

/**
 * Verify a Verifiable Presentation. Returns the verification status and error in an object
 * @param {object} presentation The verifiable presentation
 * @param {VerifiableParams} Verify parameters
 * @return {Promise<object>} verification result. The returned object will have a key `verified` which is true if the
 * presentation is valid and all the credentials are valid and not revoked and false otherwise. The `error` will
 * describe the error if any.
 */
export async function verifyPresentation(presentation, {
  challenge, domain, resolver = null, compactProof = true, forceRevocationCheck = true, revocationApi = null, schemaApi = null,
} = {}) {
  // TODO: support other purposes than the default of "authentication"
  const presVer = await vcjs.verify({
    presentation,
    suite: [new Ed25519Signature2018(), new EcdsaSepc256k1Signature2019(), new Sr25519Signature2020()],
    challenge,
    domain,
    documentLoader: documentLoader(resolver),
    compactProof,
  });

  if (presVer.verified) {
    const credentials = presentation.verifiableCredential;
    for (let i = 0; i < credentials.length; i++) {
      const credential = credentials[i];
      // Check for revocation only if the presentation is verified and revocation check is needed.
      if (isRevocationCheckNeeded(credential.credentialStatus, forceRevocationCheck, revocationApi)) {
        const res = await checkRevocationStatus(credential, revocationApi); // eslint-disable-line

        // Return error for the first credential that does not pass revocation check.
        if (!res.verified) {
          return res;
        }
      }
      // eslint-disable-next-line no-await-in-loop
      await getAndValidateSchemaIfPresent(credential, schemaApi);
    }

    // If all credentials pass the revocation check, the let the result of presentation verification be returned.
  }
  return presVer;
}

/**
 * Check that presentation is verified, i.e. the presentation and credentials have VCDM compliant structure and
 * the `proof` (signature by holder) is correct.
 * @param {object} [params] Verify parameters (TODO: add type info for this object)
 * @returns {Promise<boolean>} - Returns promise that resolves to true if the
 * presentation is valid and all the credentials are valid and not revoked and false otherwise. The `error` will
 * describe the error if any.
 */
export async function isVerifiedPresentation(presentation, params) {
  const result = await verifyPresentation(presentation, params);
  return result.verified;
}

/**
 * Return `credentialStatus` according to W3C spec when the revocation status is checked on Dock
 * @param registryId - Revocation registry id
 * @returns {{id: string, type: string}}
 */
export function buildDockCredentialStatus(registryId) {
  return { id: `${DockRevRegQualifier}${registryId}`, type: RevRegType };
}

/**
 * The function uses `jsonschema` package to verify that the `credential`'s subject `credentialSubject` has the JSON
 * schema `schema`
 * @param {object} credential - The credential to use
 * @param {object} schema - The schema to use
 * @returns {Boolean} - Returns promise to an object or throws error
 */
export function validateCredentialSchema(credential, schema) {
  const requiresID = schema.required && schema.required.indexOf('id') > -1;
  const credentialSubject = credential.credentialSubject || [];
  const subjects = credentialSubject.length ? credentialSubject : [credentialSubject];
  for (let i = 0; i < subjects.length; i++) {
    const subject = { ...subjects[i] };
    if (!requiresID) {
      // The id will not be part of schema. The spec mentioned that id will be popped off from subject
      delete subject.id;
    }
    validate(subject, schema.schema || schema, {
      throwError: true,
    });
  }
  return true;
}

/**
 * Get schema and run validation on credential if it contains both a credentialSubject and credentialSchema
 * @param {object} credential - a verifiable credential JSON object
 * @param {object} [schemaApi] - An object representing a map. "schema type -> schema API". The API is used to get
 * a schema doc. For now, the object specifies the type as key and the value as the API, but the structure can change
 * as we support more APIs there are more details associated with each API. Only Dock is supported as of now.
 * @returns {Promise<void>}
 */
export async function getAndValidateSchemaIfPresent(credential, schemaApi) {
  if (schemaApi) {
    if (credential.credentialSubject && credential.credentialSchema) {
      if (!schemaApi.dock) {
        throw new Error('Only Dock schemas are supported as of now.');
      }
      try {
        const schema = await Schema.get(credential.credentialSchema.id, schemaApi.dock);
        await validateCredentialSchema(credential, schema);
      } catch (e) {
        throw new Error(`Schema validation failed: ${e}`);
      }
    }
  }
}
