#!/usr/bin/env node
const axios = require('axios')
const argv = require('minimist')(process.argv.slice(2));
const { format } = require('date-fns');
const startOfTomorrow = require('date-fns/startOfTomorrow')
const sound = require("sound-play");
const path = require("path");
const notificationSound = path.join(__dirname, "sounds/beep.mp3");

const defaultInterval = 6; // interval between pings in minutes
const appointmentsListLimit = 2 // Increase/Decrease it based on the amount of information you want in the notification.
let timer = null;
const sampleUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'


// main script starts here #imp
// await sound.play(notificationSound);
playSound();
// mainCheckAndSchedule(28, 64);
// mainCheckAndSchedule(31, 294);
// mainCheckAndSchedule(31, 265);

function playSound(){
    while (true) {
        try {
            await sound.play(notificationSound);
        } catch(err){
            console.error("error when playing sound, retrying :", err.toString());
        }
    }
}

function mainCheckAndSchedule(age=28, district = 64) {
    argv.age = argv.age || age;
    argv.district = argv.district || district; //sonitpur district
    if (argv.help) {
        console.error('Refer documentation for more details');
    } else  {
        if (argv.key && typeof argv.key !== 'string') {
            console.error('Please provide a valid IFTTT Webook API Key by appending --key=<IFTTT-KEY> to recieve mobile notification \nRefer documentation for more details');
            return;
        } else if (argv.hook && typeof argv.hook !== 'string') {
            console.error('Please provide a valid IFTTT Webook Name Key by appending --hook=<IFTTT-WEBHOOK-NAME> to recieve mobile notification \nRefer documentation for more details');
            return;
        } else if (argv.hook && !argv.key || !argv.hook && argv.key) {
            console.error('Please provide both IFTTT Webook Name Key and IFTTT Webhook Key to recieve mobile notification \nRefer documentation for more details');
            return;
        } else if (!argv.age) {
            console.error('Please provide your age by appending --age=<YOUR-AGE> \nRefer documentation for more details');
            return;
        } else if (!argv.district) {
            console.error('Please provide required district id by appending --district=<DISTRICT-ID> \nRefer documentation for more details');
            return;
        } else if (argv.interval && argv.interval < 5) {
            console.error('Please provide an interval greater than 5 minutes');
            return;
        } else {
            // Required arguments provided through cli and checks passed
            const params = {
                key: argv.key,
                hook: argv.hook,
                age: argv.age,
                districtId: argv.district,
                interval: argv.interval || defaultInterval,
                appointmentsListLimit: argv.appts || appointmentsListLimit,
                date: format(startOfTomorrow(), 'dd-MM-yyyy')
            }

            console.log('\nCowin Pinger started succesfully\n');
            console.log(`Age= ${params.age}`);
            console.log(`District ID= ${params.districtId}`);
            console.log(`Time interval= ${params.interval} minutes (default is 15)`);
            console.log(`Appointment Count= ${params.appointmentsListLimit} (default is 2)`);
            if (params.hook && params.key) {
                console.log(`IFTTT API Key= ${params.key || "not configured"}`);
                console.log(`IFTTT Hook Name= ${params.hook || "not configured"}`);
            } else {
                console.log('\nMake sure to turn up the volume to hear the notifcation sound')
            }
            console.log('\n\n')
            scheduleCowinPinger(params, age, district);
        }
    }
    // } else {
    //     console.log('\nInvalid command\n\nRun `cowin-pinger run` with all required params to start pinging cowin portal\nRefer documentation for instructions on how to run package\n');
    // }
}

function scheduleCowinPinger(params,age, district) {
    let pingCount = 0;
    pingCowin(params, district);
    timer = setInterval(() => {
        console.clear();
        pingCount += 1;
        pingCowin(params,district);
        console.log("Ping Count - ", pingCount);
    }, params.interval * 60000);
}

function pingCowin({ key, hook, age, districtId, appointmentsListLimit, date }, district) {
    axios.get(
        `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${date}`, 
        { headers: { 'User-Agent': sampleUserAgent } 
    }).then((result) => {
        console.log("got result for " + (age < 30 ? "saikat": "saugat"), JSON.stringify(result.data, null, 2));
        const { centers } = result.data;
        let isSlotAvailable = false;
        let dataOfSlot = "";
        let appointmentsAvailableCount = 0;
        if (centers.length) {
            centers.forEach(center => {
                center.sessions.forEach((session => {
                    if (session.min_age_limit < +age && session.available_capacity > 0) {
                        isSlotAvailable = true
                        appointmentsAvailableCount++;
                        if (appointmentsAvailableCount <= appointmentsListLimit) {
                            dataOfSlot = `${dataOfSlot}\nSlot for ${session.available_capacity} is available: ${center.name} on ${session.date}`;
                        }
                    }
                }))
            });

            if (appointmentsAvailableCount - appointmentsListLimit) {
                dataOfSlot = `${dataOfSlot}\n${appointmentsAvailableCount - appointmentsListLimit} more slots available...`
            }
        }
        if (isSlotAvailable) {
            if (hook && key) {
                axios.post(`https://maker.ifttt.com/trigger/${hook}/with/key/${key}`, { value1: dataOfSlot }).then(() => {
                    console.log('Sent Notification to Phone ')
                    playSound();
                    // clearInterval(timer);
                });
            } else {
                console.log(dataOfSlot);
                console.log('Slots found')
                playSound();
                // clearInterval(timer);
            }
        }
    }).catch((err) => {
        console.log("Error: " + err.message);
    });
}
