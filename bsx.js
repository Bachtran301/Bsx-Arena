const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const WebSocket = require('ws');
const { DateTime } = require('luxon');

console.clear();
console.log(`
██████╗ ██╗   ██╗████████╗██╗ ██████╗ ██████╗  ██████╗ ██╗      
██╔══██╗██║   ██║╚══██╔══╝██║██╔════╝██╔═══██╗██╔═══██╗██║      
██████╔╝██║   ██║   ██║   ██║██║     ██║   ██║██║   ██║██║      
██╔═══╝ ██║   ██║   ██║   ██║██║     ██║   ██║██║   ██║██║      
██║     ╚██████╔╝   ██║   ██║╚██████╗╚██████╔╝╚██████╔╝███████╗ 
╚═╝      ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝ 
        `.cyan);
console.log('[+] Welcome & Enjoy Sir !'.green);
console.log('[+] Error? PM Telegram [https://t.me/NothingYub]'.red);

class Bsx {
    constructor() {
        this.headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "origin": "https://racer-bsx-dapp.vercel.app",
            "referer": "https://racer-bsx-dapp.vercel.app/",
            "sec-ch-ua": '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129", "Microsoft Edge WebView2";v="129"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"
        };
        this.ws = null;
        this.isRefillRequested = false;
        this.refillTimeout = null;
        this.predictionInterval = null;
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Waiting ${i} seconds to continue the loop`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    connectWebSocket(authorization) {
        const wsUrl = `wss://arena.bsx.exchange/ws?init_data=${authorization}`;

        this.ws = new WebSocket(wsUrl, {
            headers: {
                ...this.headers,
                "authorization": `Bearer ${authorization}`
            }
        });

        this.ws.on('open', () => {
            this.log('Starting prediction', 'success');
            this.startPredictionInterval();
        });

        this.ws.on('message', async (data) => {
            const message = JSON.parse(data);

            if (message.gas !== undefined) {
                this.log(`Remaining Gas: ${message.gas}`, 'info');
            }

            if (message.result === 'won') {
                this.log(`Win (${message.winningStreak}) | Points ${message.points} | Remaining Gas ${message.gas}`, 'custom');
            } else if (message.result === 'lost') {
                this.log(`Lost | Remaining Gas ${message.gas}`, 'custom');
            }

            if (message.gas === 0) {
                this.log('Gas is 0, refilling...', 'warning');
                this.ws.send(JSON.stringify({ event: "refill" }));

                const refillResult = await new Promise(resolve => {
                    this.ws.once('message', (data) => {
                        const refillMessage = JSON.parse(data);
                        if (refillMessage.result === 'refilled') {
                            resolve({ success: true, gas: refillMessage.gas });
                        } else if (refillMessage.result === 'time reached') {
                            resolve({ success: false, timeReached: true });
                        } else {
                            resolve({ success: false });
                        }
                    });
                });

                if (refillResult.success) {
                    this.log(`Refill successful | New gas: ${refillResult.gas}`, 'success');
                } else if (refillResult.timeReached) {
                    this.log('Cannot refill, disconnecting...', 'warning');
                    this.stopPredictionInterval();
                    this.ws.close();
                } else {
                    this.log('Failed to refill gas', 'error');
                    this.stopPredictionInterval();
                    this.ws.close();
                }
            }
        });

        this.ws.on('error', (error) => {
            this.log(`Connection error: ${error.message}`, 'error');
        });

        this.ws.on('close', () => {
            this.log('Disconnected', 'warning');
            this.stopPredictionInterval();
        });
    }

    startPredictionInterval() {
        this.predictionInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                const option = Math.random() < 0.5 ? 'moon' : 'doom';
                const winOrMiss = Math.random() < 0.8 ? "win" : "miss";
                const prediction = { event: winOrMiss, option };

                this.log(`Prediction: ${option}`, 'info');
                this.ws.send(JSON.stringify(prediction));
            }
        }, 5000);
    }

    stopPredictionInterval() {
        if (this.predictionInterval) {
            clearInterval(this.predictionInterval);
            this.predictionInterval = null;
        }
    }


    async callAPI(authorization, endpoint = "users", method = "POST", data = { "refBy": "LtcZAUnn" }) {
        const url = `https://arena.bsx.exchange/${endpoint}`;
        const headers = { ...this.headers, "authorization": `Bearer ${authorization}` };
        try {
            const response = await axios({
                method: method,
                url: url,
                headers: headers,
                data: data
            });
            if (response.status === 200) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: `HTTP error! status: ${response.status}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const authorization = data[i];
                let result = await this.callAPI(authorization);
                if (result.success) {
                    console.log(`========== Account ${i + 1} | ${result.data.username} ==========`);
                    this.log(`Successfully retrieved account information!`, 'success');
                    this.log(`Points: ${result.data.availablePoints}`, 'custom');

                    if (result.data.isBsxConnected && !result.data.farmingAvailable) {
                        this.log('Activating farming...', 'info');
                        const activateResult = await this.callAPI(authorization, "users/farming-feature/activating", "POST", {});
                        if (activateResult.success) {
                            this.log('Farming activated successfully!', 'success');
                            result = await this.callAPI(authorization);
                        } else {
                            this.log(`Farming activation error: ${activateResult.error}`, 'error');
                        }
                    }

                    if (result.data.farmingAvailable) {
                        const farmingStartTime = DateTime.fromISO(result.data.latestFarmingTime);
                        const farmingEndTime = farmingStartTime.plus({ hours: 8 });
                        const now = DateTime.now();

                        if (now > farmingEndTime) {
                            this.log('Farming time has ended. Starting farming...', 'info');
                            const farmingResult = await this.callAPI(authorization, "tasks/farming", "POST", {});
                            if (farmingResult.success) {
                                this.log('Farming successful!', 'success');
                                result = await this.callAPI(authorization);
                                const newFarmingStartTime = DateTime.fromISO(result.data.latestFarmingTime);
                                const newFarmingEndTime = newFarmingStartTime.plus({ hours: 8 });
                                const newRemainingTime = newFarmingEndTime.diff(now).toFormat("hh:mm:ss");
                                this.log(`New farming completion time: ${newRemainingTime}`, 'custom');
                            } else {
                                this.log(`Farming error: ${farmingResult.error}`, 'error');
                            }
                        } else {
                            const remainingTime = farmingEndTime.diff(now).toFormat("hh:mm:ss");
                            this.log(`Farming completion time: ${remainingTime}`, 'custom');
                        }
                    }

                    this.connectWebSocket(authorization);
                    await new Promise(resolve => {
                        this.ws.on('close', resolve);
                    });

                } else {
                    this.log(`Error reading account information: ${result.error}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(10 * 60);
        }
    }
}

const client = new Bsx();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});