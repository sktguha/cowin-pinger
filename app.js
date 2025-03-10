#!/usr/bin/env node
/* eslint-disable no-plusplus, no-console, max-len, import/no-extraneous-dependencies */
const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));
const { format } = require('date-fns');
// const startOfTomorrow = require('date-fns/startOfTomorrow');
const startOfTomorrow = require('date-fns/startOfTomorrow');
const sound = require('sound-play');
const path = require('path');

const openUrl = require('openurl');

const notificationSound = path.join(__dirname, 'sounds/beep.mp3');
const SimpleNodeLogger = require('simple-node-logger');

const opts = {
  logFilePath: 'cowinCheckLogs.log',
  timestampFormat: '"dddd, MMMM Do YYYY, h:mm:ss a"',
};
const fileLogger = SimpleNodeLogger.createSimpleLogger(opts);
const _ = require('lodash');

const defaultInterval = 0.4; // interval between pings in minutes
const defaultAppointmentsListLimit = 2; // Increase/Decrease it based on the amount of information you want in the notification.
const sampleUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36';
let timer = null;
let soundLock = false;

// main script starts here #imp
// sound.play(notificationSound);
// eslint-disable-next-line no-use-before-define
mainCheckAndSchedule(31, 294);
// mainCheckAndSchedule(31, 294);
// mainCheckAndSchedule(31, 265);

function log(...args) {
  try {
    console.log(...args);
    fileLogger.info(...args);
  } catch (e) {
    console.error('error when logging file also', e.toString());
  }
}

async function playSound() {
  if (soundLock) {
    log('refuse to play sound and open url as already sound is playing');
    return;
  }
  soundLock = true;
  try {
    openUrl.open('https://selfregistration.cowin.gov.in/dashboard');
  } catch (e) {
    log('error : ', e.toString());
  }
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sound.play(notificationSound);
    } catch (err) {
      console.error('error when playing sound, retrying :', err.toString());
    }
  }
}

function mainCheckAndSchedule(age = 28, district = 64, otherArgs = {}) {
  if (otherArgs.help) {
    console.error('Refer documentation for more details');
  } else if (otherArgs.key && typeof otherArgs.key !== 'string') {
    console.error('Please provide a valid IFTTT Webook API Key by appending --key=<IFTTT-KEY> to recieve mobile notification \nRefer documentation for more details');
  } else if (otherArgs.hook && typeof otherArgs.hook !== 'string') {
    console.error('Please provide a valid IFTTT Webook Name Key by appending --hook=<IFTTT-WEBHOOK-NAME> to recieve mobile notification \nRefer documentation for more details');
  } else if (otherArgs.hook && !otherArgs.key || !otherArgs.hook && otherArgs.key) {
    console.error('Please provide both IFTTT Webook Name Key and IFTTT Webhook Key to recieve mobile notification \nRefer documentation for more details');
  } else if (!age) {
    console.error('Please provide your age by appending --age=<YOUR-AGE> \nRefer documentation for more details');
  } else if (!district) {
    console.error('Please provide required district id by appending --district=<DISTRICT-ID> \nRefer documentation for more details');
  } else if (otherArgs.interval && otherArgs.interval < 2) {
    console.error('Please provide an interval greater than 2 minutes');
  } else {
    // Required arguments provided through cli and checks passed
    const params = {
      key: otherArgs.key,
      hook: otherArgs.hook,
      age,
      districtId: district,
      interval: otherArgs.interval || defaultInterval,
      appointmentsListLimit: otherArgs.appts || defaultAppointmentsListLimit,
      date: format(startOfTomorrow(), 'dd-MM-yyyy'),
    };

    log('\n\n\n#imp Cowin Pinger started succesfully\n');
    log(`Age= ${params.age}`);
    log(`District ID= ${params.districtId}`);
    log(`Time interval= ${params.interval} minutes (default is 15)`);
    log(`Appointment Count= ${params.appointmentsListLimit} (default is 2)`);
    if (params.hook && params.key) {
      log(`IFTTT API Key= ${params.key || 'not configured'}`);
      log(`IFTTT Hook Name= ${params.hook || 'not configured'}`);
    } else {
      log('\nMake sure to turn up the volume to hear the notifcation sound');
    }
    log('\n\n');
    // eslint-disable-next-line no-use-before-define
    scheduleCowinPinger(params, age, district);
  }
  // } else {
  //
  // eslint-disable-next-line max-len
  // log('\nInvalid command\n\nRun `cowin-pinger run` with all required params to start pinging cowin portal\nRefer documentation for instructions on how to run package\n');
  // }
}

function pingCowin({
  key, hook, age, districtId, appointmentsListLimit, date,
}) {
  // const URL = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${districtId}&date=${date}`;
  const URL = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${date}`;
  log(`pinging URL: ${URL}`);
  //   date = '10-05-2021';
  // TODO: add rate limiting here for safety ??
  axios.get(
    URL,
    { headers: { 'User-Agent': sampleUserAgent } },
  ).then((result) => {
    // log(`got result for ${age < 30 ? 'saikat' : 'saugat'}`, JSON.stringify(result.data, null, 2));
    log('got result for saugat', JSON.stringify(result.data, null, 2));
    const { centers } = result.data;
    let isSlotAvailable = false;
    let dataOfSlot = '';
    let appointmentsAvailableCount = 0;
    if (centers.length) {
      centers.forEach((center) => {
        center.sessions.forEach(((session) => {
        //   // TEMPORARY
        //   if (session?.name?.includes?.('Rangapara')) {
        //     log('ignored as rangapara', session.name);
        //     return;
        //   }

          if (session.min_age_limit < +age && session.available_capacity > 0) {
            isSlotAvailable = true;
            appointmentsAvailableCount++;
            if (appointmentsAvailableCount <= appointmentsListLimit) {
              dataOfSlot = `${dataOfSlot}\nSlot for ${session.available_capacity} is available: ${center.name} on ${session.date}`;
            }
          }
        }));
      });

      // if (appointmentsAvailableCount - appointmentsListLimit) {
      //   log({ appointmentsAvailableCount, appointmentsListLimit });
      //   dataOfSlot = `${dataOfSlot}\n${appointmentsAvailableCount - appointmentsListLimit} more slots available...`;
      // }
    }
    // openUrl.open('https://selfregistration.cowin.gov.in/appointment');
    if (isSlotAvailable) {
      if (hook && key) {
        axios.post(`https://maker.ifttt.com/trigger/${hook}/with/key/${key}`, { value1: dataOfSlot }).then(() => {
          log('Sent Notification to Phone ');
          playSound();
          // clearInterval(timer);
        });
      } else {
        log('#imp #foc Slots found');
        log(dataOfSlot);
        playSound();
        // clearInterval(timer);
      }
    }
  }).catch((err) => {
    log(`Error: ${err.message}`);
  });
}

function scheduleCowinPinger(params, age, district) {
  let pingCount = 0;
  pingCowin(params, district);
  const pingInterval = params.interval * 60000;
  log('start pinging with ping interval in milliseconds as: ', pingInterval);
  timer = setInterval(() => {
    console.clear();
    pingCount += 1;
    pingCowin(params, district);
    log('Ping Count - ', pingCount);
  }, pingInterval);
}
