import fetch from 'node-fetch';
import fs from 'fs';
// Adds extra stuff to string prototype
import colors from 'colors';

class Configuration {
    constructor(filename) {
        if (filename === null) {
        console.log('No configuration was provided.');
        process.exit(0);
        }
        const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
        this.country_code = config.country_code;
        this.device_family = config.device_family;
        this.zip_code = config.zip_code | [];
        this.selected_device_models = config.models | [];
        this.selected_carriers = config.carriers | [];
        this.selected_stores = config.stores | [];
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
        //this.stores_list_with_stock = {};
    }

    async refresh() {
        const device_list = await this.find_devices();
    }

    async find_devices() {
        const device_list = [];

        console.log("➜  Downloading Models List...".blue);

        const product_locator_response = await fetch(this.PRODUCT_LOCATOR_URL);
    }

}

async function run() {
    const checker = new StoreChecker(new Configuration('config.json'));
    await checker.refresh();
}


run().then(r => console.log("Done".green));