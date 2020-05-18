export default {
  $schema: 'http://json-schema.org/draft-07/schema#',
  description: 'Show if immunity by vaccination or testing',
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
    eventType: {
      type: 'string',
      enum: ['vaccination', 'antibody test'],
    },
    eventTime: {
      type: 'string',
      format: 'date-time',
    },
    eventBy: {
      type: 'string',
    },
    eventFacility: {
      type: 'string',
    },
    eventName: {
      type: 'string',
      enum: ['X-trans-23 vaccine', 'Serological Assay COVID-19'],
    },
    potencyDate: {
      type: 'string',
      format: 'date',
    },
  },
  required: ['firstName', 'firstInitial', 'lastName', 'lastInitial', 'photo', 'biometricTemplate', 'yearOfBirth',
    'eventType', 'eventTime', 'eventBy', 'eventFacility', 'eventName', 'potencyDate'],
};
