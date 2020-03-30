import {Keyring} from '@polkadot/api';
import {randomAsHex, encodeAddress} from '@polkadot/util-crypto';

import {DockAPI} from '../../src/api';

import {
  validateDockDIDIdentifier,
  getHexIdentifierFromDID,
  DockDIDQualifier,
  createNewDockDID,
  createKeyDetail
} from '../../src/utils/did';
import {FullNodeEndpoint, TestKeyringOpts, TestAccount} from '../test-constants';
import {getPublicKeyFromKeyringPair} from '../../src/utils/misc';
import {PublicKeyEd25519} from '../../src/public-key';
import {SignatureEd25519, SignatureSr25519} from '../../src/signature';

import BTreeSet from '@polkadot/types/codec/BTreeSet';
import { Registry } from "@polkadot/types/types";

import { Struct, Tuple, TypeRegistry, u128, createClass } from "@polkadot/types";

// pub type PAuth = BTreeMap<Did, DidSignature>;
// pub struct Registry {
//     /// Who is allowed to update this registry.
//     pub policy: Policy,
//     /// true: credentials can be revoked, but not un-revoked
//     /// false: credentials can be revoked and un-revoked
//     pub add_only: bool,
// }

// pub enum Policy {
//     OneOf {
//         /// Set of dids allowed to modify a registry.
//         controllers: BTreeSet<Did>,
//     },
// }

import {hexToU8a} from '@polkadot/util';

class RevokeRegistry {
  constructor(policy, addOnly = false) {
    this.policy = policy;
    this.addOnly = addOnly;
  }

  toJSON() {
    return {
      policy: this.policy.toJSON(),
      add_only: this.addOnly,
    };
  }
}

class Policy {
  constructor(treeSet) {
    this.treeSet = treeSet;
  }

  toJSON() {
    return {
      OneOf: this.treeSet
    };
  }
}

describe('Revocation Module', () => {
  const dock = new DockAPI(FullNodeEndpoint);

  // TODO: Uncomment the `beforeAll` and unskip the tests once a node is deployed.
  beforeAll(async (done) => {
    await dock.init();
    done();
  });

  test('Can connect to node', () => {
    //await dock.init();
    expect(!!dock.api).toBe(true);
  });

  test('Has keyring and account', () => {
    dock.keyring = new Keyring(TestKeyringOpts);
    const account = dock.keyring.addFromUri(TestAccount.uri, TestAccount.options);
    dock.setAccount(account);
    expect(!!dock.keyring).toBe(true);
    expect(!!dock.account).toBe(true);
  });

  test('Can create a registry', async () => {
    const registryID = randomAsHex(32);
    const controllerID = randomAsHex(32);

    /*const ctrlSet = new BTreeSet();
    ctrlSet.add(dock.api.createType('dock::did::Did', controllerID));
    const policy = new Policy(ctrlSet);
    const registry = new RevokeRegistry(policy, false);
    console.log('registry', registry);*/

    //const typeReg = new TypeRegistry();
    const didType = createClass(dock.api.registry, 'dock::did::Did');
    const s = new Set();
    s.add(dock.api.createType('dock::did::Did', controllerID));
    const ctrlSet = new BTreeSet(dock.api.registry, didType, s);
    const policy = new Policy(ctrlSet);
    const registry = new RevokeRegistry(policy, false);

    /*const testdid = dock.api.createType('dock::did:Did', controllerID);
    const treeRegistry = testdid.registry;
    console.log('treeRegistry', treeRegistry);
    console.log('testdid', testdid);*/

    // const controllerSet = new Set();
    // controllerSet.add(testdid);

    /*const Did = createClass(treeRegistry, 'dock::did:Did');

    const treeSet = new BTreeSet(treeRegistry, Did, controllerSet);*/

    //const policy = new Policy(treeSet);
    //const registry = new RevokeRegistry(policy, false);

    //console.log('treeSet', treeSet);

    // creating the types this way doesnt seem to work either, similar error
    // const policyTest = dock.api.createType('dock::revoke::Policy', {
    //   OneOf: treeSet
    // });
    // const testRegistry = dock.api.createType('dock::revoke::Registry', {
    //   policy: {
    //     OneOf: []
    //   },
    //   add_only: true
    // });
    // console.log('testRegistry', testRegistry)

    // registry json is like:
    // { policy: { OneOf: { controllers: [BTreeSet] } },
    //   add_only: false }
    // tried using array of strings for controllersm, still same error

    console.log('registry', registry.toJSON());

    const transaction = dock.revocation.newRegistry(registryID, registry);
    const result = await dock.sendTransaction(transaction);
    expect(!!result).toBe(true);
    const reg = await dock.revocation.getRevocationRegistry(registryID);
    expect(!!reg).toBe(true);
  }, 30000);
});
