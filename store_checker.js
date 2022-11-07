import fetch from 'node-fetch';
import fs from 'fs';
// Adds extra stuff to string prototype
import colors from 'colors';
import ProgressBar from "progress";
import { PromiseQueue } from 'spq';

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
        this.appointment_stores = config.appointment_stores;
    }
}

class StoreChecker {
    constructor(configuration) {
        this.configuration = configuration;
        this.base_url = `https://www.apple.com/${configuration.country_code}/`;
        this.PRODUCT_LOCATOR_URL = `${this.base_url}shop/product-locator-meta?family=${configuration.device_family}`;
        this.PRODUCT_AVAILABILITY_URL = (device) => `${this.base_url}shop/retail/pickup-message?pl=true&parts.0=${device}&location=${configuration.zip_code}`;
        //this.STORE_APPOINTMENT_AVAILABILITY_URL = `https://retail-pz.cdn-apple.com/product-zone-prod/availability/{0}/{1}/availability.json`;
        this.stores_list_with_stock = {};
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

        const bar = new ProgressBar(`:current/:total ${'['.red}${':bar'.green}${']'.red} :percent`.cyan, {total: device_list.length});

        const customQueue = new PromiseQueue(2);
        const QueuedTask = customQueue.QueuedTask;

        let promises = [];
        for (const device of device_list) {
            promises.push(QueuedTask(async (resolve) => {
                await this.check_stores_for_device(device)
                bar.tick();
                resolve();
            }));
        }

        await Promise.all(promises);

        const stores = Object.values(this.stores_list_with_stock).sort((a, b) => {
            return a.sequence - b.sequence;
        });

        let stock_available = false;

        for (const store of stores) {
            console.log(`\n\n${store.storeName.green}, ${store.city.green}, (${store.storeId.green})`);
        }
    }



    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async check_stores_for_device(device) {
        //console.log(device);
        const url = this.PRODUCT_AVAILABILITY_URL(device.model);
        //console.log("\n" + url);
        let availability;

        let attempts = 10;

        while (attempts-- > 0) {
            availability = await fetch(url);

            if(availability.status === 200) {
                attempts = 0;
            } else {
                await this.delay(10000);
            }
        }



        if(availability.status !== 200) {
            console.log(`❌ Error fetching one or more devices, code: ${availability.status}`.red);
            process.exit(0);
        }

        const availabilityJson = await availability.json();

        const store_list = availabilityJson.body.stores;

        for(let store of store_list) {
            let current_store = this.stores_list_with_stock[store.storeNumber];
            if(!current_store) {
                current_store = {
                    "storeId": store.storeNumber,
                    "storeName": store.storeName,
                    "city": store.city,
                    "sequence": store.storeListNumber,
                    "parts": {},
                }
            }
            let new_parts = store.partsAvailability
            let old_parts = current_store.parts;
            old_parts = new_parts;
            current_store["parts"] = old_parts;
            //If the store is in the list of user's preferred list, add it to the
            // list to check for stock.
            if (
                this.configuration.selected_stores.includes(store.storeNumber)
                || this.configuration.selected_stores.length == 0
                 ){
                this.stores_list_with_stock[store.storeNumber] = current_store;
            }

        }
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

            console.log("Looking for stock for the following models: ".blue, `\n${device_list.map(device => device.title).join(',\n')}`.cyan);
        } catch (e) {
            console.log("❌ Unable to download models list.".red);
            console.warn(e);
            process.exit(0);
        }

        return device_list;

    }

}

async function run() {
    const checker = new StoreChecker(new Configuration('config.json'));
    await checker.refresh();
}


run().then(r => console.log("Done".green));