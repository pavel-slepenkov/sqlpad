/* eslint-disable no-console */
const fs = require('fs');
const SocksConnection = require('socksjs');
const { formatSchemaQueryResults } = require('../utils');
const jsforce = require('jsforce');
const appLog = require('../../lib/app-log');
const { table } = require('console');

const id = 'salesforce';
const name = 'Salesforce';

/**
 * Run query for connection
 * Should return { rows, incomplete }
 * @param {string} query
 * @param {object} connection
 */
function runQuery(query, connection) {
  let conn = new jsforce.Connection({ loginUrl: connection.instance });

  // todo
  if (connection.accessToken != null) {
    console.log('✅ accessToken exists!! ✅');

    conn = new jsforce.Connection({
      instanceUrl: connection.instance,
      accessToken: connection.accessToken,
    });
  }

  return new Promise((resolve, reject) => {
    // do not login each time to the org, store access token
    conn.login(
      connection.username,
      connection.password + connection.securityToken,
      function (err, res) {
        if (err) {
          return reject(err);
        }
        connection.accessToken = conn.accessToken;
        query = query.replace(new RegExp('--(\\d|\\w| )+\\n', 'g'), '\n');
        conn.query(query, function (err, res) {
          if (err) {
            console.error(err);
            return reject(err);
          }

          console.log('⭐️⭐️⭐️ result ⭐️⭐️⭐️');
          // console.log(res);
          console.log('-------------------------------------');

          if (res.done) {
            // todo most probably not optimized way to do this
            res.records.forEach((record) => {
              delete record.attributes;
            });
            return resolve({ rows: res.records });
          }
        });
      }
    );
  });
}

function formatSOQLResults(results) {}
/**
 * Test connectivity of connection
 * @param {*} connection
 */
function testConnection(connection) {
  const query = 'SELECT Id, Name FROM Account LIMIT 1';
  return runQuery(query, connection);
}

/**
 * Get schema for connection
 * @param {*} connection
 */
async function getSchema(connection) {
  if (!global.isSFSchemaUpdateRunning) {
    global.isSFSchemaUpdateRunning = true;
    const tables = await runQuery(
      'SELECT QualifiedApiName FROM EntityDefinition order by QualifiedApiName',
      connection
    );
    const ar = async (tables) => {
      let tableDefinitions = [];
      for (const table of tables['rows']) {
        let query =
          "SELECT QualifiedApiName, DataType, MasterLabel FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '" +
          table['QualifiedApiName'] +
          "'";
        console.log('query for ' + table['QualifiedApiName']);
        // eslint-disable-next-line no-await-in-loop
        let tableFields = await runQuery(query, connection);
        tableFields['rows'].forEach((field) => {
          tableDefinitions.push({
            table_schema: 'salesforce',
            table_name: table['QualifiedApiName'],
            column_name: field['QualifiedApiName'],
            data_type: field['DataType'],
            column_description: field['MasterLabel'],
          });
        });
      }
      global.isSFSchemaUpdateRunning = false;
      return tableDefinitions;
    };

    return formatSchemaQueryResults({
      rows: await ar(tables),
    });
  }
}

const fields = [
  {
    key: 'instance',
    formType: 'TEXT',
    label: 'Instance URL',
  },
  {
    key: 'username',
    formType: 'TEXT',
    label: 'Username',
  },
  {
    key: 'password',
    formType: 'PASSWORD',
    label: 'Password',
  },
  {
    key: 'securityToken',
    formType: 'PASSWORD',
    label: 'Security Token',
  },
];

module.exports = {
  id,
  name,
  fields,
  getSchema,
  runQuery,
  testConnection,
};
