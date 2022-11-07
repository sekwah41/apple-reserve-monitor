import fetch from 'node-fetch';
import fs from 'fs';
// Adds extra stuff to string prototype
import colors from 'colors';
import { Webhook, MessageBuilder } from 'discord-webhook-node';

class Configuration {
    constructor(filename) {
        if (filename === null) {
        console.log('No configuration was provided.');
        process.exit(0);
        }
        const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
        this.country_code = config.country_code;
        this.device_family = config.device_family;
        this.zip_code = config.zip_code || [];
        this.selected_device_models = config.models || [];
        this.selected_carriers = config.carriers || [];
        this.product = config.product || [];
        this.selected_stores = config.stores || [];
        this.message = config.message;

        this.hook = new Webhook(config.webhook);
        this.hook.setUsername("DVLA Availability Checker");
        this.hook.setAvatar("https://cdn.discordapp.com/emojis/496451824690135070.png");
    }
}

class StoreChecker {
    constructor(configuration) {
        this.configuration = configuration;
        this.PRODUCT_LOCATOR_URL = `https://www.apple.com/gb/shop/product-locator-meta?family=${configuration.device_family}`;
        this.STORE_INFO = "https://reserve-prime.apple.com/GB/en_GB/reserve/A/stores.json";
        this.PRODUCT_AVAILABILITY_URL = "https://reserve-prime.apple.com/GB/en_GB/reserve/A/availability.json";
    }

    async refresh() {
        const device_list = await this.find_devices();

        if (device_list) {
            console.log("✔ Found".green, `${device_list.length}`.cyan, "devices matching your config.".green)
        } else {
            console.log("❌ No devices found matching your config.".red);
            process.exit(0);
        }

        console.log("➜ Downloading Stock Information for the devices...".blue);


        const stores = (await fetch(this.STORE_INFO).then(response => response.json())).stores;
        const availability = await fetch(this.PRODUCT_AVAILABILITY_URL).then(response => response.json());

        function findDeviceFromPartNumber(model) {
            return device_list.find(device => device.model === model);
        }

        function findStoreFromNumber(storeNumber) {
            return stores.find(store => store.storeNumber === storeNumber);
        }

        /**
         * Devices found that meet all criteria and are in stock
         * @type {*[]}
         */
        const foundDevices = [];

        for (const storeId in availability.stores) {
            let store = availability.stores[storeId];
            for(const itemId in store) {
                let item = store[itemId];
                if (item.availability) {
                    // Despite the uK not having contract versions it still seems to use that value
                    if(item.availability.contract) {
                        if(this.configuration.selected_stores.length === 0 || this.configuration.selected_stores.includes(storeId)) {
                            foundDevices.push(`${findStoreFromNumber(storeId).city} (${storeId}), ${findDeviceFromPartNumber(itemId).title}`);
                        }
                    }
                }
            }
        }

        console.log(foundDevices);

        return foundDevices;
    }

    async find_devices() {
        const device_list = [];

        console.log("➜ Downloading Models List...".blue);

        try {

            const product_locator_response = await fetch(this.PRODUCT_LOCATOR_URL).then(response => response.json());

            const product_list = product_locator_response.body.productLocatorOverlayData.productLocatorMeta.products;

            product_list.forEach(product => {
                if (this.configuration.selected_device_models.length === 0 || this.configuration.selected_device_models.includes(product.model)) {
                    if (this.configuration.selected_carriers.length === 0 || this.configuration.selected_carriers.includes(product.carrier)) {
                        if (this.configuration.product.length === 0 || this.configuration.product.find((item) => product.productTitle.toLowerCase().includes(item.toLowerCase()))) {
                            //console.log(product);
                            device_list.push({
                                "title": product.productTitle,
                                "model": product.partNumber,
                                "carrier": product.carrierModel
                            });
                        }
                    }
                }
            });

            console.log("Looking for stock for the following models: ".blue, `\n${device_list.map(device => device.title + ` (${device.model})`).join(',\n')}`.cyan);
        } catch (e) {
            console.log("❌ Unable to download models list.".red);
            console.warn(e);
            process.exit(0);
        }

        return device_list;

    }

}

let lastFailedUpdate = 0;
let lastSuccessUpdate = 0;
const ONE_HOUR = 1000 * 60 * 60;

async function run() {
    const checker = new StoreChecker(new Configuration('config.json'));
    async function checkAndSend() {
        const foundDevices = await checker.refresh();


        const embed = new MessageBuilder().setDescription()
            .setFooter("Checking every 10 mins");
        if (foundDevices.length > 0) {
            if(lastSuccessUpdate + ONE_HOUR < Date.now()) {
                lastSuccessUpdate = Date.now();
                embed.setColor("#35ff00")
                    .setTitle("Devices Found in Stock")
                    .setDescription(`${foundDevices.join('\n')}\n\nhttps://reserve-prime.apple.com/GB/en_GB/reserve/A/availability`)
                    .setText(checker.configuration.message);
                await checker.configuration.hook.send(embed);
            }
        } else {

            if(lastFailedUpdate + (ONE_HOUR * 2) < Date.now()) {
                lastFailedUpdate = Date.now();
                embed.setColor("#ff0000")
                    .setTitle("Nothing found")
                    .setDescription(`Could not find any devices matching: ${checker.configuration.product.join(", ")}\n\nNegative checks will be muted for the next 2 hours.`);

                await checker.configuration.hook.send(embed);
            }
        }

    }
    setInterval(checkAndSend, 10 * 60 * 1000);
    checkAndSend();
}


run().then(r => console.log("Done".green));