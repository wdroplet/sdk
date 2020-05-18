import { randomAsHex, encodeAddress } from '@polkadot/util-crypto';
import { validate } from 'jsonschema';

import JSONSchema07 from '../utils/vc/schemas/schema-draft-07';
import { fetchJSONFromUrl, getSignatureFromKeyringPair } from '../utils/misc';
import Signature from '../signatures/signature';


export const BlobQualifier = 'blob:dock:';
export const EncodedIDByteSize = 48;

// Size of the blob id in bytes
export const BLOB_ID_MAX_BYTE_SIZE = 32;

// Maximum size of the blob in bytes
// implementer may choose to implement this as a dynamic config option settable with the `parameter_type!` macro
export const BLOB_MAX_BYTE_SIZE = 1024;

/**
 * Generates a random schema ID
 * @returns {string}
 */
export function createNewSchemaID() {
  const hexId = randomAsHex(BLOB_ID_MAX_BYTE_SIZE);
  const ss58Id = encodeAddress(hexId);
  return `${BlobQualifier}${ss58Id}`;
}

export default class Schema {
  /**
   * Creates a new `Schema` object
   * @constructor
   * @param {string} [id] - optional schema ID, if not given, generate a random id
   */
  constructor(id) {
    // TODO: `id` should be validated?
    this.id = id || createNewSchemaID();
    this.name = '';
    this.version = '1.0.0';
  }

  /**
   * Add the JSON schema to this object after checking that `json` is a valid JSON schema. Check if JSON is valid.
   * @param {object} json - the schema JSON
   */
  async setJSONSchema(json) {
    await Schema.validateSchema(json);
    this.schema = json;
  }

  /**
  * Update the object with `author` key. Repeatedly calling it will keep resetting the author
  * did can be a DID hex identifier or full DID
  * @param {string} did - the author DID
  */
  setAuthor(did) {
    // TODO: `did` should be validated, do a best effort. Check either 32 byte (use constant) hex or a valid Dock DID or starts with 'did'
    this.author = did;
  }

  /**
  * Update the object with `signature` key. This method is used when
  * signing key/capability is not present and the signature is received from outside.
  * Repeatedly calling it will keep resetting the `signature` key.
  * The signature must be one of the supported objects
  * @param {object} signature - The schema's signatuer
  */
  setSignature(signature) {
    if (signature instanceof Signature) {
      this.signature = signature;
    } else {
      throw new Error('Provided signature object is not of instance Signature');
    }
  }

  /**
  * Serializes the object using `getSerializedBlob` and then signs it using the given
  * polkadot-js pair. The object will be updated with key `signature`. Repeatedly calling it will
  * keep resetting the `signature` key
  * @param {object} pair - Key pair to sign with
  */
  sign(pair) {
    // TODO: proper message when we have getSerializedBlob from fausto
    const msg = [1, 2, 3, 4];
    this.signature = getSignatureFromKeyringPair(pair, msg);
  }

  /**
   * Serializes to JSON for sending to the node, as `Blob`. A full DID is converted to the
   * hex identifier and signature object is converted to the enum
   * @returns {any}
   */
  toJSON() {
    const {
      signature,
      ...rest
    } = this;
    return rest;
  }

  /**
   * Check that the given JSON schema is compliant with JSON schema spec mentioned in RFC
   * @param {object} json - The JSON schema to validate
   * @returns {Promise<ValidatorResult>} - Returns promise to an object or throws error
   */
  static async validateSchema(json) {
    // Get the JSON schema spec to check against.
    const jsonSchemaSpec = await this.getJSONSchemaSpec(json);
    return validate(json, jsonSchemaSpec, {
      throwError: true,
    });
  }

  /**
   * Get schema from from the chain using the given id, by querying the blob storage.
   * Accepts a full blob id like blob:dock:0x... or just the hex identifier and the `DockAPI` object.
   * The returned schema would be formatted as specified in the RFC (including author DID, schema id) or an error is
   * returned if schema is not found on the chain or in JSON format.
   * @param {string} id - The Schema ID
   * @param {object} dockApi - The Dock API
   * @returns {any}
   */
  static async getSchema(id, dockApi) {
    // TODO: requires blob module
    if (id === 'invalid-format') {
      throw new Error('Incorrect schema format', dockApi);
    } else if (id === 'invalid-id') {
      throw new Error(`Invalid schema id ${id}`, dockApi);
    }

    return {};
  }

  /**
   * Gets the JSON schema spec from given JSON. Will either return the stored JSON schema or get
   * it using HTTP or will throw error if cannot get.
   * @param {object} json
   * @returns {Promise<object>}
   */
  static async getJSONSchemaSpec(json) {
    const schemaKey = '$schema';
    const schemaUrl = json[schemaKey];
    if (schemaUrl) {
      // The URL might be 'http://json-schema.org/draft-07/schema' or 'http://json-schema.org/draft-07/schema#'
      // In that case, the schema is already stored in the SDK as this is the latest JSON schema spec
      if (schemaUrl === 'http://json-schema.org/draft-07/schema' || schemaUrl === 'http://json-schema.org/draft-07/schema#') {
        // Return stored JSON schema
        return JSONSchema07;
      }
      return fetchJSONFromUrl(schemaUrl);
    } else {
      throw new Error(`${schemaKey} not found in the given JSON`);
    }
  }

  /**
   * Get schema using HTTP or from chain using given API
   * @param schemaId
   * @param schemaAPI
   */
  static async resolveSchema(schemaId, schemaAPI) {
    try {
      // Check if the schemaId is a URL
      const url = new URL(schemaId);
    } catch (e) {
      // Get schema from Dock
      if (!schemaId.startsWith(BlobQualifier)) {
        throw new Error(`Schema id should begin with ${BlobQualifier}`);
      }
      if (!schemaAPI.dock) {
        throw new Error('Only Dock schema support is present as of now.');
      }
      const dockAPI = schemaAPI.dock;
      const schema = await Schema.getSchema(schemaId, dockAPI);
      // TODO:
    }
    return fetchJSONFromUrl(schemaId);
  }

  /**
   * Takes a validator and a schema and adds the schema and the schemas it depends to the validator
   * @param validator
   * @param initialSchema
   * @param schemaAPI
   * @returns {Promise<void>}
   */
  static async updateSchemaValidatorWithSchemas(validator, initialSchema, schemaAPI) {
    validator.addSchema(initialSchema);
    const initialSchemaId = initialSchema.id || '/';
    console.log('initialSchemaId', initialSchemaId);
    async function importNextSchema() {
      let nextSchemaId = validator.unresolvedRefs.shift();
      console.log('nextSchemaId', nextSchemaId);
      if (!nextSchemaId) { return; }
      // TODO: Clean this up.
      // JSON schema assumes the URI is http(s) and would only contain one colon (':') in the protocol.
      // Getting around that by converting an id like 'blob:dock/:' to 'blob:dock:'
      if (nextSchemaId.startsWith('blob:dock/:')) {
        nextSchemaId = nextSchemaId.slice('blob:dock/:'.length);
        nextSchemaId = BlobQualifier + nextSchemaId;
      }

      if (!nextSchemaId.startsWith(`${initialSchemaId}#/$defs`)) {
        const nextSchema = await Schema.resolveSchema(nextSchemaId, schemaAPI);
        validator.addSchema(nextSchema);
      }
      await importNextSchema();
    }
    await importNextSchema();
  }
}
