const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');

class Tsubasa {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://app.ton.tsubasa-rivals.com",
            "Referer": "https://app.ton.tsubasa-rivals.com/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.config = this.loadConfig();
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [t.me/scriptsharing] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [t.me/scriptsharing] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [t.me/scriptsharing] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [t.me/scriptsharing] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [t.me/scriptsharing] ${msg}`.blue);
        }
    }

    loadConfig() {
        const configPath = path.join(__dirname, 'config.json');
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error("Can't read file Config:", error.message);
            return {
                enableCardUpgrades: true,
                maxUpgradeCost: 1000000,
            };
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Wait ${i}s to continue =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async callStartAPI(initData) {
        const startUrl = "https://app.ton.tsubasa-rivals.com/api/start";
        const startPayload = { lang_code: "en", initData: initData };
        
        try {
            const startResponse = await axios.post(startUrl, startPayload, { headers: this.headers });
            if (startResponse.status === 200 && startResponse.data && startResponse.data.game_data) {
                const { total_coins, energy, max_energy, coins_per_tap, profit_per_second } = startResponse.data.game_data.user || {};
                const masterHash = startResponse.data.master_hash;
                if (masterHash) {
                    this.headers['X-Masterhash'] = masterHash;
                }
                
                const tasks = startResponse.data.task_info 
                ? startResponse.data.task_info.filter(task => task.status === 0 || task.status === 1)
                : [];
                
                return { 
                    total_coins, 
                    energy, 
                    max_energy, 
                    coins_per_tap, 
                    profit_per_second, 
                    tasks,
                    success: true 
                };
            } else {
                return { success: false, error: `Failed call api start` };
            }
        } catch (error) {
            return { success: false, error: `Failed call api start: ${error.message}` };
        }
    }

    async callTapAPI(initData, tapCount) {
        const tapUrl = "https://app.ton.tsubasa-rivals.com/api/tap";
        const tapPayload = { tapCount: tapCount, initData: initData };
        
        try {
            const tapResponse = await axios.post(tapUrl, tapPayload, { headers: this.headers });
            if (tapResponse.status === 200) {
                const { total_coins, energy, max_energy, coins_per_tap, profit_per_second } = tapResponse.data.game_data.user;
                return { total_coins, energy, max_energy, coins_per_tap, profit_per_second, success: true };
            } else {
                return { success: false, error: `Failed tap: ${tapResponse.status}` };
            }
        } catch (error) {
            return { success: false, error: `Failed tap: ${error.message}` };
        }
    }

    async callDailyRewardAPI(initData) {
        const dailyRewardUrl = "https://app.ton.tsubasa-rivals.com/api/daily_reward/claim";
        const dailyRewardPayload = { initData: initData };
        
        try {
            const dailyRewardResponse = await axios.post(dailyRewardUrl, dailyRewardPayload, { headers: this.headers });
            if (dailyRewardResponse.status === 200) {
                return { success: true, message: "Daily check-in Sucess" };
            } else {
                return { success: false, message: "Daily check-in has been claimed" };
            }
        } catch (error) {
            if (error.response && error.response.status === 400) {
                return { success: false, message: "Daily check-in has been claimed" };
            }
            return { success: false, message: `Daily check-in failed: ${error.message}` };
        }
    }

    async executeTask(initData, taskId) {
        const executeUrl = "https://app.ton.tsubasa-rivals.com/api/task/execute";
        const executePayload = { task_id: taskId, initData: initData };
        
        try {
            const executeResponse = await axios.post(executeUrl, executePayload, { headers: this.headers });
            return executeResponse.status === 200;
        } catch (error) {
            this.log(`Task claim failed ${taskId}: ${error.message}`);
            return false;
        }
    }

    async checkTaskAchievement(initData, taskId) {
        const achievementUrl = "https://app.ton.tsubasa-rivals.com/api/task/achievement";
        const achievementPayload = { task_id: taskId, initData: initData };
        
        try {
            const achievementResponse = await axios.post(achievementUrl, achievementPayload, { headers: this.headers });
            if (achievementResponse.status === 200) {
                if (achievementResponse.data && achievementResponse.data && achievementResponse.data.task_info) {
                    const updatedTask = achievementResponse.data.task_info.find(task => task.id === taskId);
                    if (updatedTask && updatedTask.status === 2) {
                        return { success: true, title: updatedTask.title, reward: updatedTask.reward };
                    }
                }
            }
            return { success: false };
        } catch (error) {
            this.log(`Task failed ${taskId}: ${error.message}`);
            return { success: false };
        }
    }


    async getCardInfo(initData) {
        const startUrl = "https://app.ton.tsubasa-rivals.com/api/start";
        const startPayload = { lang_code: "en", initData: initData };
        
        try {
            const startResponse = await axios.post(startUrl, startPayload, { headers: this.headers });
            if (startResponse.status === 200 && startResponse.data && startResponse.data.card_info) {
                const cardInfo = startResponse.data.card_info.flatMap(category => {
                    return category.card_list.map(card => ({
                        categoryId: card.category,
                        cardId: card.id,
                        level: card.level,
                        cost: card.cost,
                        unlocked: card.unlocked,
                        name: card.name,
                        profitPerHour: card.profit_per_hour,
                        nextProfitPerHour: card.next_profit_per_hour
                    }));
                });
                return cardInfo;
            } else {
                console.log("Card infor not found!");
                return null;
            }
        } catch (error) {
            console.log(`Get card infor error: ${error.message}`);
            return null;
        }
    }

    async levelUpCards(initData, totalCoins) {
        if (!this.config.enableCardUpgrades) {
            console.log(" Card upgrade are disable in file config.");
            return totalCoins;
        }

        let updatedTotalCoins = totalCoins;
        let leveledUp = false;
        let cooldownCards = new Set();

        do {
            leveledUp = false;
            const cardInfo = await this.getCardInfo(initData);
            if (!cardInfo) {
                console.log("Failed to get card information. Cancel upgrade!");
                break;
            }

            const sortedCards = cardInfo.sort((a, b) => b.nextProfitPerHour - a.nextProfitPerHour);

            for (const card of sortedCards) {
                if (cooldownCards.has(card.cardId)) {
                    continue;
                }

                if (card.unlocked && updatedTotalCoins >= card.cost && card.cost <= this.config.maxUpgradeCost) {
                    const levelUpUrl = "https://app.ton.tsubasa-rivals.com/api/card/levelup";
                    const levelUpPayload = {
                        category_id: card.categoryId,
                        card_id: card.cardId,
                        initData: initData
                    };

                    try {
                        const levelUpResponse = await axios.post(levelUpUrl, levelUpPayload, { headers: this.headers });
                        if (levelUpResponse.status === 200) {
                            updatedTotalCoins -= card.cost;
                            leveledUp = true;
                            this.log(`Upgrade Card ${card.name} (${card.cardId}) up level ${card.level + 1}. Cost: ${card.cost}, Balance remain: ${updatedTotalCoins}`);
                            break;
                        }
                    } catch (error) {
                        if (error.response && error.response.status === 400 && error.response.data && error.response.data.message === 'Wait for cooldown') {
                            this.log(`Cooldown time | Card ${card.name} (${card.cardId})`, 'warning');
                            cooldownCards.add(card.cardId);
                        } else {
                            this.log(`Card upgare error ${card.name} (${card.cardId}): ${error.message}`, 'error');
                        }
                    }
                }
            }
        } while (leveledUp);

        return updatedTotalCoins;
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        let lastUpgradeTime = 0;

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initData = data[i];
                const firstName = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0])).first_name;
                
                this.log(`========== Account ${i + 1} | ${firstName} ==========`, 'custom');

                const startResult = await this.callStartAPI(initData);
                if (startResult.success) {
                    if (startResult.total_coins !== undefined) {
                        this.log(`Balance: ${startResult.total_coins}`);
                        this.log(`Energy: ${startResult.energy}/${startResult.max_energy}`);
                        this.log(`Coins per tap: ${startResult.coins_per_tap}`);
                        this.log(`Profit/second: ${startResult.profit_per_second}`);
                    }

                    if (startResult.tasks && startResult.tasks.length > 0) {
                        for (const task of startResult.tasks) {
                            const executeResult = await this.executeTask(initData, task.id);
                            if (executeResult) {
                                const achievementResult = await this.checkTaskAchievement(initData, task.id);
                                if (achievementResult.success) {
                                    this.log(`Task ${achievementResult.title} Success | Reward ${achievementResult.reward}`, 'success');
                                }
                            }
                        }
                    } else {
                        this.log(`All task completed.`, 'warning');
                    }

                    if (startResult.energy !== undefined) {
                        const tapResult = await this.callTapAPI(initData, startResult.energy);
                        if (tapResult.success) {
                            this.log(`Tap success | Energy remain ${tapResult.energy}/${tapResult.max_energy} | Balance : ${tapResult.total_coins}`, 'success');
                        } else {
                            this.log(tapResult.error, 'error');
                        }
                    }

                    const dailyRewardResult = await this.callDailyRewardAPI(initData);
                    this.log(dailyRewardResult.message, dailyRewardResult.success ? 'success' : 'warning');
                    const updatedTotalCoins = await this.levelUpCards(initData, startResult.total_coins);
                    this.log(`Upgrade all card with setup condition | Balance: ${updatedTotalCoins}`, 'success');
                } else {
                    this.log(startResult.error, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(60);
        }
    }
}

const client = new Tsubasa();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});