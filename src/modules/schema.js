import { stringToHex, u8aToString, u8aToHex } from '@polkadot/util';
import { canonicalize } from 'json-canonicalize';
import { validate } from 'jsonschema';
import axios from 'axios';

import { getHexIdentifierFromDID, hexDIDToQualified } from '../utils/did';
import { getSignatureFromKeyringPair } from '../utils/misc';
import { isHexWithGivenByteSize } from '../utils/codec';
import Signature from '../signatures/signature';

import {
  DockBlobIdByteSize,
  createNewDockBlobId,
  getHexIdentifierFromBlobID,
} from './blob';

// Supported schemas
import JSONSchema07 from '../utils/vc/schemas/schema-draft-07';

export default class Schema {
  /**
   * Creates a new `Schema` object
   * @constructor
   * @param {string} [id] - optional schema ID, if not given, generate a random id
   */
  constructor(id) {
    this.id = id || createNewDockBlobId();
  }

  static fromJSON(json) {
    const {
      id, schema, author,
    } = json;

    const schemaObj = new Schema(id);

    if (schema) {
      schemaObj.schema = schema;
    }

    if (author) {
      schemaObj.setAuthor(author);
    }

    return schemaObj;
  }

  /**
   * Add the JSON schema to this object after checking that `json` is a valid JSON schema. Check if JSON is valid.
   * @param {object} json - the schema JSON
   */
  async setJSONSchema(json) {
    await Schema.validateSchema(json);
    this.schema = json;
    return this;
  }

  /**
   * Update the object with `author` key. Repeatedly calling it will keep resetting the author
   * did can be a DID hex identifier or full DID
   * @param {string} did - the author DID
   */
  setAuthor(did) {
    if (did.startsWith('did:') || isHexWithGivenByteSize(did, DockBlobIdByteSize)) {
      this.author = did;
    } else {
      throw new Error(`Supplied author ${did} is not a valid DID or ${DockBlobIdByteSize} byte hex string`);
    }
    return this;
  }

  /**
   * Update the object with `signature` key. This method is used when
   * signing key/capability is not present and the signature is received from outside.
   * Repeatedly calling it will keep resetting the `signature` key.
   * The signature must be one of the supported objects
   * @param {object} signature - The schema's signature
   */
  setSignature(signature) {
    if (signature instanceof Signature) {
      this.signature = signature;
    } else {
      throw new Error('Provided signature object is not of instance Signature');
    }

    return this;
  }

  /**
   * Serializes the object using `getSerializedBlob` and then signs it using the given
   * polkadot-js pair. The object will be updated with key `signature`. Repeatedly calling it will
   * keep resetting the `signature` key
   * @param {object} pair - Key pair to sign with
   */
  sign(pair, blobModule) {
    const serializedBlob = blobModule.getSerializedBlob(this.toBlob());
    this.signature = getSignatureFromKeyringPair(pair, serializedBlob);
    return this;
  }

  /**
   * Serializes schema object to JSON
   * @returns {object}
   */
  toJSON() {
    const {
      signature,
      ...rest
    } = this;

    return {
      ...rest,
    };
  }

  /**
   * Serializes the schema to a blob object to send to the node
   * @returns {object}
   */
  toBlob() {
    if (!this.schema) {
      throw new Error('Schema requires schema property to be serialized to blob');
    }

    if (!this.author) {
      throw new Error('Schema requires author property to be serialized to blob');
    }

    return {
      id: getHexIdentifierFromBlobID(this.id),
      blob: stringToHex(canonicalize(this.schema)),
      author: getHexIdentifierFromDID(this.author),
    };
  }

  /**
   * Prepares a transaction to write this schema object to the dock chain using the blob module
   * @param {object} dock - The dock API
   * @param {object} pair - The keypair to sign with
   * @return {object} The extrinsic to sign and send.
   */
  writeToChain(dock, pair) {
    return dock.blob.new(this.toBlob(), pair);
  }

  /**
   * Check that the given JSON schema is compliant with JSON schema spec mentioned in RFC
   * @param {object} json - The JSON schema to validate
   * @returns {Promise<object>} - Returns promise to an object or throws error
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
   * @returns {Promise<object>}
   */
  static async get(id, dockApi) {
    const hexId = getHexIdentifierFromBlobID(id);
    const chainBlob = await dockApi.blob.get(hexId);
    const blobStr = u8aToString(chainBlob[1]);
    try {
      const schema = JSON.parse(blobStr);
      schema.id = id;
      schema.author = hexDIDToQualified(u8aToHex(chainBlob[0]));

      return schema;
    } catch (e) {
      throw new Error(`Incorrect schema format: ${e}`);
    }
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
      // Fetch the URI and expect a JSON response
      const { data: doc } = await axios.get(schemaUrl);
      if (typeof doc === 'object') {
        return doc;
      }
      // If MIME type did not indicate JSON, try to parse the response as JSON
      try {
        return JSON.parse(doc);
      } catch (e) {
        throw new Error('Cannot parse response as JSON');
      }
    } else {
      throw new Error(`${schemaKey} not found in the given JSON`);
    }
  }
}
