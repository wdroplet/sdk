export default {
  $schema: 'http://json-schema.org/draft-07/schema#',
  // TODO: Use a proper id once blob integration is done in SDK
  description: 'Diagnosis with viral infection on a particular date',
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
    diagnosisCode: {
      type: 'string',
      enum: ['CodeA', 'CodeB', 'CodeC'],
    },
    diagnosisTime: {
      type: 'string',
      format: 'date-time',
    },
    diagnosisLocation: {
      type: 'string',
    },
    diagnosedBy: {
      type: 'string',
    },
    diagnosisFacility: {
      type: 'string',
    },
    diagnosisMethods: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
      },
    },
    declaredSafeDate: {
      type: 'string',
      format: 'date',
    },
  },
  required: ['firstName', 'firstInitial', 'lastName', 'lastInitial', 'photo', 'biometricTemplate', 'yearOfBirth',
    'diagnosisCode', 'diagnosisTime', 'diagnosisLocation', 'diagnosedBy', 'diagnosisFacility', 'diagnosisMethods', 'declaredSafeDate'],
};
