'use strict';

const args = process.argv.slice(2);

// Npm modules
const promise = require('bluebird');
const nedb = require('nedb');
const ip = require('ip');

// Data
const systemData = promise.promisifyAll(new nedb({ filename: 'system-data.db', autoload: true }));
const interfacePrefData = promise.promisifyAll(new nedb({ filename: 'interface-prefs.db', autoload: true }));
const pluginPrefData = promise.promisifyAll(new nedb({ filename: 'plugin-prefs.db', autoload: true }));
const basePrefData = promise.promisifyAll(new nedb({ filename: 'base-prefs.db', autoload: true }));
const usersData = promise.promisifyAll(new nedb({ filename: 'users.db', autoload: true }));
const cronData = promise.promisifyAll(new nedb({ filename: 'cron.db', autoload: true }));

// Woodhouse modules
const systemPrefsClass = require('./lib/systemPrefs.js');
const moduleLoaderClass = require('./lib/moduleLoader.js');
const moduleDataClass = require('./lib/moduleData.js');
const dispatcherClass = require('./lib/dispatcher.js');
const usersClass = require('./lib/users.js');
const cronClass = require('./lib/cron.js');
const yesNoClass = require('./lib/yesNo.js');
const coreListenersClass = require('./lib/coreListeners.js');
const upgradeClass = require('./lib/upgrade.js');
const broadcastClass = require('./lib/broadcast.js');

const upgrade = new upgradeClass(systemData, interfacePrefData, pluginPrefData, basePrefData, usersData, cronData);

if (args.includes('--rollback-upgrade')) {
    return upgrade.rollback();
}

const upgradePromise = upgrade.run();

if (!args.includes('--upgrade-only')) {
    upgradePromise.then(() => {
        return basePrefData.findOneAsync({name: 'name'})
    }).catch((error) => {
        console.log(error.message);
        process.exit();
    }).then(function(instanceName){
        const yesNo = new yesNoClass();
        const cron = new cronClass(cronData);
        cron.loadSaved();
        const users = new usersClass(usersData);
        const broadcast = new broadcastClass();
        const moduleData = new moduleDataClass(interfacePrefData, pluginPrefData);
        const systemPrefs = new systemPrefsClass(basePrefData);
        const dispatcher = new dispatcherClass(users, moduleData, systemPrefs);
        const moduleLoader = new moduleLoaderClass(dispatcher, moduleData, systemPrefs, cron, yesNo, broadcast);
        const coreListeners = new coreListenersClass(dispatcher, moduleData, systemPrefs, cron, yesNo, users);
        moduleLoader.getModules();

        return {
            yesNo,
            cron,
            users,
            broadcast,
            moduleData,
            systemPrefs,
            dispatcher,
            moduleLoader,
            coreListeners,
        }
    }).then((systemModules) => {
        const data = [
                systemModules.moduleData.getPref(`interface`, `rpc-api`, `port`),
                systemModules.moduleData.getPref(`interface`, `rpc-api`, `domain`),
                systemModules.systemPrefs.get('name'),
                systemModules.systemPrefs.get('id')
            ];

        promise.all(data).then(([apiPort, domain, name, id]) => {
            setInterval(() => {
                systemModules.broadcast.send({
                    name: 'core'
                }, {
                    ip: ip.address(),
                    apiPort,
                    domain,
                    name,
                    id
                });
            }, 120000)
        });
    });
}

