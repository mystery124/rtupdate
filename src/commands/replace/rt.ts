import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('rtupdate', 'org');

export default class Org extends SfdxCommand {
  public static RT_ID_COLUMN = 'RecordTypeId';


  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
  `$ sfdx hello:org --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    sobject: flags.string({char: 'o', description: 'sobject Name'}),
    rtname: flags.boolean({char: 'r', description: 'Record Type column name'}),
    file: flags.boolean({char: 'f', description: 'CSV file name'})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    const conn = this.org.getConnection();
    const rtQuery = 'Select DeveloperName, Id FROM RecordType WHERE sObjectType = \''+this.flags.sobject+'\'';

    interface RecordType {
      DeveloperName: string;
      Id: string;
    }

    // Query the org
    const result = await conn.query<RecordType>(rtQuery);

    // Organization will always return one result, but this is an example of throwing an error
    // The output and --json will automatically be handled for you.
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.org.getOrgId()]));
    }

    let recordTypeIdByDevName = {};

    for(let value of result.records){
      recordTypeIdByDevName[value.DeveloperName] = value.Id;
    }
    const csv = require('csv-parser');
    const fs = require('fs');

    let csvData = [];

    fs.createReadStream(this.flags.file)
    .pipe(csv())
    .on('data', (data) => csvData.push(data))
    .on('end', () => {
      this.ux.log(csvData.length.toString() + ' - entries found in dictionary');
      this.replace(csvData, recordTypeIdByDevName);
      this.saveCSV(csvData);
  });

    return { status: 'OK' };
  }

  /**
   * replace
   */
  public replace(csvData, recordTypeIdByDevName) {
    for(let value of csvData){
      let rtName = value[this.flags.rtname];
      if(rtName && recordTypeIdByDevName[rtName]){
        value[Org.RT_ID_COLUMN] = recordTypeIdByDevName[rtName];
      }
    }
  }

  /**
   * saveCSV
   */
  public saveCSV(csvData) {
    const fastcsv = require('fast-csv');
    const fs = require('fs');
    const ws = fs.createWriteStream(this.flags.file);
    fastcsv
      .write(csvData, { headers: true })
      .pipe(ws);
  }
}
