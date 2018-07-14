/**
 *  Copyright 2018 Angus.Fenying <fenying@litert.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
    IResourceZone,
    IDriver,
    ISerializer,
    IUnserializer,
    IdentityValueType,
    AsyncArray,
    ReadResult,
    CacheBody
} from "./common";
import { EventEmitter } from "events";

const DEFAULT_NEVER_EXISTED_TTL: number = 900;
const DEFAULT_TTL: number = 0; // Forever

class Entry {

    public name: string;

    public buildKey: KeyBuilder;

    public ttl: number;

    public neTTL: number;

    public keys: Record<string, IdentityValueType>;

    public constructor(
        resource: string,
        name: string,
        keys: Record<string, IdentityValueType>,
        ttl: number,
        neTTL: number,
        attachment?: string
    ) {

        this.buildKey = compileCacheKeyBuilder(
            resource,
            name,
            <any> keys,
            attachment
        );
        this.name = name;
        this.ttl = ttl;
        this.neTTL = neTTL;
        this.keys = JSON.parse(JSON.stringify(keys));
    }
}

class Attachment<T = any> extends Entry {

    public serialize: ISerializer<T>;

    public unserialize: IUnserializer<T>;

    public constructor(
        resource: string,
        name: string,
        keys: Record<string, IdentityValueType>,
        ttl: number,
        neTTL: number,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>
    ) {

        super(
            resource,
            name,
            keys,
            ttl,
            neTTL,
            name
        );

        this.serialize = serializer;
        this.unserialize = unserializer;
    }
}

type KeyBuilder = (identities: Record<string, any>) => string;

function compileCacheKeyBuilder(
    resource: string,
    entryName: string,
    identities: Record<string, string>,
    attachment?: string
): KeyBuilder {

    let segs: string[] = [ resource, entryName ];

    if (attachment) {

        segs.splice(1, 0, "attach", attachment);
    }

    for (let keyName in identities) {

        segs.push(keyName);

        switch (identities[keyName]) {
        case "string":
        case "number":
            segs.push(`\${ids.${keyName}}`);
            break;
        case "buffer":
            segs.push(`\${ids.${keyName}.toString("base64")}`);
            break;
        case "boolean":
            segs.push(`\${ids.${keyName} ? "true" : "false"}`);
            break;
        }
    }

    return <any> new Function("ids", `return \`${segs.join(":")}\`; `);
}

class ResourceZone<T>
extends EventEmitter
implements IResourceZone<T> {

    private _name: string;

    private _entries: Record<string, Entry>;

    private _attachments: Record<string, Attachment<any>>;

    private _driver: IDriver;

    private _serialize: ISerializer<T>;

    private _unserialize: IUnserializer<T>;

    public constructor(
        name: string,
        driver: IDriver,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>
    ) {
        super();

        this._name = name;

        this._entries = {};

        this._attachments = {};

        this._driver = driver;

        this._serialize = serializer;

        this._unserialize = unserializer;
    }

    public get name(): string {

        return this._name;
    }

    public registerEntry(
        name: string,
        keys: Partial<Record<keyof T, IdentityValueType>>,
        ttl: number = DEFAULT_TTL,
        neTTL: number = DEFAULT_NEVER_EXISTED_TTL
    ): this {

        this._assertEntry(name, false);

        this._entries[name] = new Entry(
            this._name,
            name,
            <any> keys,
            ttl,
            neTTL
        );

        return this;
    }

    private _assertCacheUsable(): void {

        if (!this._driver.usable()) {

            throw new Error(`Cache driver is down.`);
        }
    }

    private _assertEntry(name: string, exists: boolean): void {

        if (exists !== !!this._entries[name]) {

            if (exists) {

                throw new Error(
                    `Entry "${
                        name
                    }" doesn't exist in resource "${
                        this._name
                    }".`
                );
            }
            else {

                throw new Error(
                    `Entry "${
                        name
                    }" already exists in resource "${
                        this._name
                    }".`
                );
            }
        }
    }

    public async read(
        entry: string,
        identity: Record<string, any>
    ): Promise<ReadResult<T>> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            let ret = await this._driver.get(
                this._entries[entry].buildKey(identity)
            );

            if (ret === null || ret === undefined) {

                return ret;
            }

            return this._unserialize(ret);
        }
        catch (e) {

            this.emit("error", e);

            return null;
        }
    }

    public async readMulti(
        entry: string,
        identities: Array<Record<string, any>>
    ): AsyncArray<ReadResult<T>> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            let cacheKeys: string[] = [];

            const buildKey = this._entries[entry].buildKey;

            for (let identity of identities) {

                cacheKeys.push(buildKey(identity));
            }

            let result = await this._driver.getMulti(cacheKeys);

            let ret: Array<ReadResult<T>> = [];

            for (let identity of cacheKeys) {

                const item = result[identity];

                if (item === null || item === undefined) {

                    ret.push(item);
                }
                else {

                    ret.push(this._unserialize(item));
                }
            }

            return ret;
        }
        catch (e) {

            this.emit("error", e);

            return identities.map((x) => null);
        }
    }

    public async write(
        entry: string,
        data: T,
        identity?: Record<string, any>,
        ttl?: number
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            const theEntry = this._entries[entry];

            return this._driver.set(
                theEntry.buildKey(identity || <any> data),
                this._serialize(data),
                ttl === undefined ? theEntry.ttl : ttl
            );
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async writeMulti(
        entry: string,
        data: T[],
        identities?: Array<Record<string, any>>
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            const theEntry = this._entries[entry];

            const caches: Record<string, CacheBody> = {};

            if (identities) {

                if (identities.length !== data.length) {

                    throw new Error(
                        "Length of data and identities not matched."
                    );
                }

                for (let i = 0; i < data.length; i++) {

                    caches[theEntry.buildKey(identities[i])] = this._serialize(
                        data[i]
                    );
                }
            }
            else {

                for (let item of data) {

                    caches[theEntry.buildKey(item)] = this._serialize(item);
                }
            }

            return this._driver.setMulti(caches, theEntry.ttl);
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async put(
        data: T,
        ttl?: number
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            let prs: Array<Promise<boolean>> = [];

            let cacheBody = this._serialize(data);

            for (let entry in this._entries) {

                const theEntry = this._entries[entry];

                prs.push(this._driver.set(
                    theEntry.buildKey(<any> data),
                    cacheBody,
                    ttl === undefined ? theEntry.ttl : ttl
                ));
            }

            await Promise.all(prs);

            return true;
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async putMulti(
        data: T[]
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            let prs: Array<Promise<boolean>> = [];

            for (let item of data) {

                let cacheBody = this._serialize(item);

                for (let entry in this._entries) {

                    const theEntry = this._entries[entry];

                    prs.push(this._driver.set(
                        theEntry.buildKey(<any> item),
                        cacheBody,
                        theEntry.ttl
                    ));
                }
            }

            await Promise.all(prs);

            return true;
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async markNeverExist(
        entry: string,
        identity: Record<string, any>
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            const theEntry = this._entries[entry];

            return this._driver.set(
                theEntry.buildKey(identity),
                undefined,
                theEntry.neTTL
            );
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async markMultiNeverExist(
        entry: string,
        identities: Array<Record<string, any>>
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            const theEntry = this._entries[entry];

            const caches: Record<string, CacheBody> = {};

            for (let item of identities) {

                caches[theEntry.buildKey(item)] = undefined;
            }

            return this._driver.setMulti(caches, theEntry.neTTL);
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async exists(
        entry: string,
        identity: Record<string, any>
    ): Promise<boolean | undefined> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            return this._driver.exists(this._entries[entry].buildKey(identity));
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async remove(
        entry: string,
        identity: Record<string, any>
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            return this._driver.remove(
                this._entries[entry].buildKey(identity)
            );
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async removeMulti(
        entry: string,
        identities: Array<Record<string, any>>
    ): Promise<number> {

        try {

            this._assertCacheUsable();

            this._assertEntry(entry, true);

            const buildKey = this._entries[entry].buildKey;

            const keys: string[] = [];

            for (let item of identities) {

                keys.push(buildKey(item));
            }

            return this._driver.removeMulti(keys);
        }
        catch (e) {

            this.emit("error", e);

            return 0;
        }
    }

    private _assertAttachment(name: string, exists: boolean): void {

        if (exists !== !!this._attachments[name]) {

            if (exists) {

                throw new Error(
                    `Attachment "${
                        name
                    }" doesn't exist in resource "${
                        this._name
                    }".`
                );
            }
            else {

                throw new Error(
                    `Entry "${
                        name
                    }" already exists in resource "${
                        this._name
                    }".`
                );
            }
        }
    }

    public registerAttachment<TA>(
        name: string,
        entry: string,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>,
        ttl: number = DEFAULT_TTL,
        neTTL: number = DEFAULT_NEVER_EXISTED_TTL
    ): this {

        this._assertEntry(entry, true);
        this._assertAttachment(name, false);

        this._attachments[name] = new Attachment(
            this._name,
            name,
            this._entries[entry].keys,
            ttl,
            neTTL,
            serializer,
            unserializer
        );

        return this;
    }

    public async readAttachment<TA = any>(
        name: string,
        identity: Partial<T>
    ): Promise<ReadResult<TA>> {

        try {

            this._assertCacheUsable();

            this._assertAttachment(name, true);

            const attach = this._attachments[name];

            let ret = await this._driver.get(
                attach.buildKey(identity)
            );

            if (ret === null || ret === undefined) {

                return ret;
            }

            return attach.unserialize(ret);
        }
        catch (e) {

            this.emit("error", e);

            return null;
        }
    }

    public async writeAttachment<TA = any>(
        name: string,
        identity: Partial<T>,
        data: TA
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertAttachment(name, true);

            const attach = this._attachments[name];

            return this._driver.set(
                attach.buildKey(identity),
                attach.serialize(data),
                attach.ttl
            );
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async removeAttachment(
        name: string,
        identity: Record<string, any>
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            this._assertAttachment(name, true);

            return this._driver.remove(
                this._attachments[name].buildKey(identity)
            );
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async removeAllAttachments(
        data: T
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            const keys: string[] = [];

            for (let name in this._attachments) {

                keys.push(
                    this._attachments[name].buildKey(<any> data)
                );
            }

            await this._driver.removeMulti(keys);

            return true;
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }

    public async flush(
        data: T,
        includeAttachment: boolean = false
    ): Promise<boolean> {

        try {

            this._assertCacheUsable();

            const keys: string[] = [];

            for (let entry in this._entries) {

                keys.push(this._entries[entry].buildKey(<any> data));
            }

            if (includeAttachment) {

                for (let name in this._attachments) {

                    keys.push(this._attachments[name].buildKey(<any> data));
                }
            }

            await this._driver.removeMulti(keys);

            return true;
        }
        catch (e) {

            this.emit("error", e);

            return false;
        }
    }
}

export function createZone<T>(
    name: string,
    driver: IDriver,
    serializer: ISerializer<T>,
    unserializer: IUnserializer<T>
): IResourceZone<T> {

    return new ResourceZone(
        name,
        driver,
        serializer,
        unserializer
    );
}
