const DockDIDQualifier = 'did:dock';
// Byte size of the Dock DID identifier, i.e. the `DockDIDQualifier` is not counted.
const DockDIDByteSize = 32;

import {isHexWithGivenByteSize} from './utils';

/** Class to create, update and destroy DIDs */
class DIDModule {
  /**
   * Creates a new instance of DIDModule and sets the api
   * @constructor
   * @param {object} api - PolkadotJS API Reference
   */
  constructor(api) {
    this.api = api;
    this.module = api.tx.didModule;
  }

  /**
   * Creates a new DID on the Dock chain.
   * @param {string} did - The new DID
   * @param {string} controller - The DID of the public key's controller
   * @param {PublicKey} public_key - A public key associated with the DID
   * @return {Extrinsic} The extrinsic to sign and send.
   */
  new(did, controller, public_key) {
    // Controller and did should be valid Dock DIDs
    DIDModule.validateDockDIDIdentifier(did);
    DIDModule.validateDockDIDIdentifier(controller);
    return this.module.new(did, {
      controller,
      public_key,
    });
  }

  /**
   * Updates the details of an already registered DID on the Dock chain.
   * @param {string} did - DID
   * @param {Signature} signature - Signature from existing key
   * @param {PublicKey} public_key -The new public key
   * @param {optional string} controller - The new key's controller
   * @return {Extrinsic} The extrinsic to sign and send.
   */
  updateKey(did, signature, public_key, controller) {
    DIDModule.validateDockDIDIdentifier(did);
    if (controller) {
      DIDModule.validateDockDIDIdentifier(controller);
    }
    const keyUpdate = {
      did,
      controller,
      public_key,
      last_modified_in_block: 0,
    };

    return this.module.updateKey(keyUpdate, signature);
  }

  /**
   * Removes an already registered DID on the Dock chain.
   * @param {string} did - DID
   * @param {Signature} signature - Signature from existing key
   * @return {Extrinsic} The extrinsic to sign and send.
   */
  remove(did, signature) {
    DIDModule.validateDockDIDIdentifier(did);
    return this.module.remove({
      did,
      last_modified_in_block: 0,
    }, signature);
  }

  /**
   * Gets a DID from the Dock chain and create a DID document according to W3C spec.
   * @param {string} did - DID
   * @return {object} The DID document.
   */
  async getDocument(did) {
    // TODO: Convert DID and pk to base58
    const resp = await this.api.query.didModule.dids(did);
    if (resp) {
      if (resp.isSome) {
        const detail = resp.unwrap()[0];
        // Create the fully qualified DID like "did:dock:..."
        const id = `${DockDIDQualifier}:${did}`;

        // Determine the type of the public key
        let type, publicKeyBase58;
        if (detail.public_key.isSr25519) {
          type = 'Sr25519VerificationKey2018';
          publicKeyBase58 = detail.public_key.asSr25519;
        } else if (detail.public_key.isEd25519) {
          type = 'Ed25519VerificationKey2018';
          publicKeyBase58 = detail.public_key.asEd25519;
        } else {
          type = 'EcdsaSecp256k1VerificationKey2019';
          publicKeyBase58 = detail.public_key.asSecp256K1;
        }

        // The DID has only one key as of now.
        const publicKey = [{
          'id': `${id}#keys-1`,
          type,
          'controller': `${DockDIDQualifier}:${detail.controller}`,
          publicKeyBase58
        }];

        const authentication = publicKey.map(key => key.id);

        return {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id,
          publicKey,
          authentication
        };
      } else {
        throw 'Could not find DID: ' + did;
      }
    } else {
      throw 'Got null response';
    }
  }

  /**
   * Check if the given identifier is 32 byte hex
   * @param {identifier} identifier - The identifier to check.
   * @return {null} Throws exception if invalid identifier
   */
  static validateDockDIDIdentifier(did) {
    if (!isHexWithGivenByteSize(did, DockDIDByteSize)) {
      throw `DID identifier must be ${DockDIDByteSize} bytes`;
    }
  }
}

export default DIDModule;
