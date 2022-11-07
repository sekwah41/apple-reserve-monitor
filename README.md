
Based on https://github.com/insanoid/Apple-Store-Reserve-Monitor

This has been modified to find devices available for the upgrade program and uses the simpler endpoints to do so.

It specifically works for the UK atm but if you need it for another country, you can change the URL's used.

Though I rewrote it as it was having issues parsing some of the json or couldnt handle the 503 errors apple would sometimes return.

Parts of the script also seemed broken at the time of writing this. Possibly due to an API update on apples behalf on the data they return.

There are also some edits to the config to make it easier to find the devices e.g. you can search by product title and itll partially match it.

E.g. if you want a 'iPhone 14 Pro Max 512GB' and dont care about color you'd just ignore the color at the end.

See https://github.com/insanoid/Apple-Store-Reserve-Monitor for more info.

Also rather than a noise I will likely trigger a webhook to alert via a service like discord.