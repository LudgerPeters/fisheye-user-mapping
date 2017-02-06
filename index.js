let Promise = require("bluebird");
let mysql = require('promise-mysql');
let config = require('./config.json');
let fs = require("fs");
Promise.promisifyAll(fs);
let xml2js = require('xml2js');
let parser = new xml2js.Parser();
Promise.promisifyAll(parser);

let insertSQL = "INSERT INTO `fisheye`.`cru_committer_user_mapping` " +
    "(`cru_committer_name`, `cru_repository_name`, `cru_user_name`) " +
    "VALUES (?, ?, ?);";

let connection;
let existingMappsings;
let usernameToDisplayname;
let repoNames;


mysql.createConnection(config.db).then(conn => {
    connection = conn;
    return connection.query('SELECT * FROM fisheye.cru_committer_user_mapping');
}).then(rows => {
    existingMappsings = rows;
    return connection.query('SELECT user_name, lower_display_name FROM fisheye.cwd_user;');
}).then(rows => {
    usernameToDisplayname = rows;
    console.log(existingMappsings,usernameToDisplayname);
    // console.log(config.fisheyeConfig);
    return fs.readFileAsync(config.fisheyeConfig)
}).then(fileData => {
    return parser.parseStringAsync(fileData);
}).then(fileData => {
    repoNames = fileData.config.repository.map(repo => {
        return repo.$ && repo.$.name? repo.$.name:null;
    }).filter(repoName => repoName != null);
    console.log(repoNames);
    let retPromises = [];
    usernameToDisplayname.forEach(userToDisplay => {
        let userName = userToDisplay.user_name;
        let displayName = userToDisplay.lower_display_name;
        repoNames.forEach(repoName => {
            let existingMapping = existingMappsings.find(mapping =>
            mapping.cru_committer_name == displayName &&
            mapping.cru_repository_name == repoName &&
            mapping.cru_user_name == userName);
            if(existingMapping) console.log("existing mapping for : ",displayName,"=>",repoName,"=>",userName);
            else {
                console.log("creating mapping for : ",displayName,"=>",repoName,"=>",userName)
                retPromises.push(connection.query(insertSQL,[displayName,repoName,userName]));
            }
        });
    });
    console.log("creating ",retPromises.length," new mappings")
    return Promise.all(retPromises);
}).then(args => {
    console.log("Finished creating mappings");
}).catch (error => {
    console.log("An Exception Was Thrown: ",error);
}).finally(()=>{
    console.log("Attempting to End Connection");
    connection.end();
});