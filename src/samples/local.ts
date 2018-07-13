// tslint:disable:no-console

import {
    IDriver,
    NO_DATA,
    AsyncNullable,
    CacheBody,
    Nullable
} from "../libs/common";

import { createResourceZone } from "../libs/ResourceZone";

class Item {

    public _data: Buffer;

    public _expiredAt: number;

    public constructor(data: Buffer | string, ttl: number) {

        this._data = typeof data === "string" ? Buffer.from(data) : data;

        this._expiredAt = ttl > 0 ? Date.now() : 0;
    }

    public isExpired(): boolean {

        return this._expiredAt > 0 && this._expiredAt < Date.now();
    }

    public get data(): Buffer | null {

        return this.isExpired() ? this._data : null;
    }
}

class LocalDriver
implements IDriver {

    private _usable: boolean;

    private _data: Record<string, Item>;

    public constructor() {

        this._data = {};

        this._usable = true;
    }

    public async exists(key: string): Promise<boolean | symbol> {

        let result = (this._data[key] && this._data[key].data) || null;

        if (!result) {

            return false;
        }

        if (result.length === 1 && result[0] === 48) {

            return NO_DATA;
        }

        return true;
    }

    public async get(key: string): AsyncNullable<CacheBody> {

        let result = (this._data[key] && this._data[key].data) || null;

        if (!result) {

            return result;
        }

        if (result.length === 0) {

            return NO_DATA;
        }

        return result;
    }

    public async getMulti(
        keys: string[]
    ): Promise<Record<string, Nullable<CacheBody>>> {

        let ret: Record<string, Nullable<CacheBody>> = {};

        for (let key of keys) {

            let data = (this._data[key] && this._data[key].data) || null;

            if (!data) {

                ret[key] = null;
            }
            else if (data.length === 0) {

                ret[key] = NO_DATA;
            }
            else {

                ret[key] = data;
            }
        }

        return ret;
    }

    public async set(
        key: string,
        data: CacheBody,
        ttl: number
    ): Promise<boolean> {

        if (typeof data === "symbol") {

            this._data[key] = new Item("", ttl);
        }
        else {

            this._data[key] = new Item(data, ttl);
        }

        return true;
    }

    public async setMulti(
        data: Record<string, CacheBody>,
        ttl: number
    ): Promise<boolean> {

        for (const key in data) {

            const item = data[key];

            if (typeof item === "symbol") {

                this._data[key] = new Item("", ttl);
            }
            else {

                this._data[key] = new Item(item, ttl);
            }
        }

        return true;
    }

    public async remove(key: string): Promise<boolean> {

        delete this._data[key];

        return true;
    }

    public async removeMulti(keys: string[]): Promise<number> {

        let i = 0;

        for (let key of keys) {

            if (this._data[key]) {

                i++;
                delete this._data[key];
            }
        }

        return i;
    }

    public usable(): boolean {

        return this._usable;
    }

    public setUnusable(): void {

        this._usable = false;
    }
}

interface User {

    id: number;

    name: string;

    email: string;

    system: number;
}

(async () => {

    let driver = new LocalDriver();

    const users = createResourceZone<User>(
        "users",
        driver,
        JSON.stringify,
        <any> JSON.parse
    );

    users.on("error", function(e): void {

        console.error(e);
    });

    users.registerEntry("primary", {"id": "number"});
    users.registerEntry("email", {
        "email": "string",
        "system": "number"
    });
    users.registerEntry("name", {
        "name": "string",
        "system": "number"
    });

    users.registerAttachment(
        "roles",
        "primary",
        JSON.stringify,
        <any> JSON.parse,
        3600
    );

    users.registerAttachment(
        "wallet",
        "primary",
        JSON.stringify,
        <any> JSON.parse,
        3600
    );

    const theUser = {
        id: 123,
        name: "hello",
        email: "admin@sample.com",
        system: 33
    };

    await users.put(theUser);

    await users.markNeverExist("primary", {id: 321});
    await users.markNeverExist("email", {email: "dddd", system: 31});

    console.log(await users.read("primary", {id: 123}));
    console.log(await users.read("email", {
        email: "admin@sample.com",
        system: 33
    }));
    await users.markMultiNeverExist("primary", [
        {"id": 444 },
        {"id": 555 }
    ]);
    console.log(await users.read("primary", {id: 321}));
    console.log(await users.read("primary", {id: 333}));
    console.log(await users.read("primary", {id: 555}));
    console.log(await users.read("email", {email: "dddd", system: 31}));

    console.log(await users.readAttachment("roles", { id: 123 }));

    console.log(await users.writeAttachment("wallet", { id: 123 }, 0));

    console.log(await users.readAttachment("wallet", { id: 123 }));

    console.log(await users.writeAttachment("roles", { id: 123 }, [1, 2, 3]));

    console.log(await users.readAttachment("roles", { id: 123 }));

    console.log(await users.removeAttachment("roles", { id: 123 }));

    console.log(await users.readAttachment("roles", { id: 123 }));

    console.log(await users.writeAttachment("roles", { id: 123 }, [1, 2, 3]));

    console.log(await users.removeAllAttachments(theUser));

    console.log(await users.readAttachment("roles", theUser));

    console.log(await users.readAttachment("wallet", theUser));

    await users.flush(theUser);

    await users.put(theUser);

    console.log(await users.writeAttachment("wallet", { id: 123 }, 0));

    console.log(await users.writeAttachment("roles", { id: 123 }, [1, 2, 3]));

    await users.flush(theUser, true);

    driver.setUnusable();

    console.log(await users.read("primary", {id: 321}));

})().catch((e) => {

    console.error(e.message);
    console.error(e.stack);
});
