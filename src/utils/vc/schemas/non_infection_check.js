export default {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Found virus free after testing',
  type: 'object',
  $defs: {
    uri: {
      type: 'string',
      format: 'uri',
    },
  },
  properties: {
    // TODO: Change the id once blob integration is done in SDK
    firstName: { $ref: '/blob:dock:5D/firstName' },
    firstInitial: { $ref: '/blob:dock:5D/firstInitial' },
    lastName: { $ref: '/blob:dock:5D/lastName' },
    lastInitial: { $ref: '/blob:dock:5D/lastInitial' },
    yearOfBirth: { $ref: '/blob:dock:5D/yearOfBirth' },
    photo: { $ref: '/blob:dock:5D/photo' },
    biometricTemplate: { $ref: '/blob:dock:5D/biometricTemplate' },
    virus: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
      },
    },
    checkTime: {
      type: 'string',
      format: 'date-time',
    },
    checkLocation: {
      type: 'string',
    },
    checkedBy: {
      type: 'string',
    },
    checkFacility: {
      type: 'string',
    },
    diagnosisMethods: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
      },
    },
  },
  required: ['firstName', 'firstInitial', 'lastName', 'lastInitial', 'photo', 'biometricTemplate', 'yearOfBirth',
    'virus', 'checkTime', 'checkLocation', 'checkedBy', 'checkFacility', 'diagnosisMethods'],
};
