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

export type Nullable<T> = T | null;

export type AsyncNullable<T> = Promise<Nullable<T>>;

export type AsyncArray<T> = Promise<T[]>;

export type IdentityValueType = "string" | "number" | "buffer" | "boolean";

export type ReadResult<T> = Nullable<T> | undefined;

/**
 * The data entity of cache item.
 *
 * @note
 *  When the entity is undefined, it means the data entity is NEVER-EXISTED in
 *  the reality.
 */
export type CacheBody = Buffer | string | undefined;

export type ISerializer<T> = (data: T) => CacheBody;

export type IUnserializer<T> = (data: Buffer | string) => T;

export interface IResourceZone<T> {

    /**
     * The name of resource zone.
     */
    readonly name: string;

    /**
     * Register a handler for ERROR event.
     *
     * @param ev        The name of event.
     * @param handler   The handler of event.
     */
    on(ev: "error", handler: (e: Error) => void): this;

    /**
     * Register a handler for an event.
     *
     * @param ev        The name of event.
     * @param handler   The handler of event.
     */
    on(ev: string, handler: Function): this;

    /**
     * Remove all handlers of an event.
     *
     * @param ev        The name of event.
     */
    removeAllListeners(ev: string): this;

    /**
     * Remove a handler for an event.
     *
     * @param ev        The name of event.
     * @param handler   The handler of event.
     */
    removeListener(ev: string, handler: Function): this;

    /**
     * Register a new cache entry of resource.
     *
     * @param name  The name of entry.
     * @param keys  The keys of entry.
     * @param ttl   The cache TTL of entry. Default: 0 (forever)
     * @param neTTL The NEVER-EXISTED cache TTL of entry. Default: 900 (s)
     */
    registerEntry(
        name: string,
        keys: Partial<Record<keyof T, IdentityValueType>>,
        ttl?: number,
        neTTL?: number
    ): this;

    /**
     * Register a new cache entry of resource.
     *
     * @param name  The name of attachment.
     * @param entry The entry of resource that binds the attachment.
     * @param ttl   The cache TTL of entry. Default: 0 (forever)
     * @param neTTL The NEVER-EXISTED cache TTL of entry. Default: 900 (s)
     */
    registerAttachment<TA>(
        name: string,
        entry: string,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>,
        ttl?: number,
        neTTL?: number
    ): this;

    /**
     * Fetch an attachment of the specific resource item.
     *
     * @param name      The name of attachment.
     * @param identity  The identity of resource that attachment belongs to.
     * @return
     *
     *  Return a Promise with the result of following possible values:
     *
     *  - undefined, if that the attachment item is marked NEVER-EXISTED.
     *  - The data record, if the attachment item exists in cache.
     *  - null, if the attachment item is not found in cache.
     */
    readAttachment<TA = any>(
        name: string,
        identity: Partial<T>
    ): Promise<ReadResult<TA>>;

    /**
     * Write a piece of attachment item into cache.
     *
     * @param entry      The entry of attachment items to be written.
     * @param identity   The identity of attachment items to be written.
     * @param data       The data of attachment item to be written.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the attachment item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    writeAttachment<TA = any>(
        name: string,
        identity: Partial<T>,
        data: TA
    ): Promise<boolean>;

    /**
     * Remove a piece of attachment item from cache.
     *
     * @param entry     The entry of attachment items to be removed.
     * @param identity  The identity of attachment item to be removed.
     * @returns
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  The promise-result will be TRUE if the attachment item is deleted or it
     *  doesn't exist. Otherwise the promise-result will be FALSE.
     */
    removeAttachment(
        name: string,
        identity: Partial<T>
    ): Promise<boolean>;

    /**
     * Remove all the cache of a resource item's attachments.
     *
     * @param data              The resource item of attachments to be removed.
     */
    removeAllAttachments(
        data: T
    ): Promise<boolean>;

    /**
     * Fetch a piece of resource item by its key.
     *
     * @param entry    The entry of resource item to be fetched.
     * @param identity The identity of resource item to be fetched.
     * @return
     *
     *  Return a Promise with the result of following possible values:
     *
     *  - undefined, if that the resource item is marked NEVER-EXISTED.
     *  - The data record, if the resource item exists in cache.
     *  - null, if the resource item is not found in cache.
     */
    read(
        entry: string,
        identity: Partial<T>
    ): Promise<ReadResult<T>>;

    /**
     * Fetch multiple pieces of resource items by their keys.
     *
     * @param entry      The entry of resource items to be fetched.
     * @param identities The identity of resource items to be fetched.
     */
    readMulti(
        entry: string,
        identities: Array<Partial<T>>
    ): AsyncArray<ReadResult<T>>;

    /**
     * Write a piece of resource item into cache.
     *
     * @param entry      The entry of resource items to be written.
     * @param data       The data of resource item to be written.
     * @param identity   The identity of resource items to be written.
     *                   Default: Use identity from data
     * @param ttl        Setup the TTL for this item. Default: <Entry TTL>
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    write(
        entry: string,
        data: T,
        identity?: Partial<T>,
        ttl?: number
    ): Promise<boolean>;

    /**
     * Write a piece of resource item into cache.
     *
     * @param entry      The entry of resource items to be written.
     * @param data       The data of resource items to be written.
     * @param identities The identity of resource items to be written.
     *                   Default: Use identity from data
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    writeMulti(
        entry: string,
        data: T[],
        identities?: Array<Partial<T>>
    ): Promise<boolean>;

    /**
     * Write all entries of a resource item into cache.
     *
     * @param data  The data of resource item to be written.
     * @param ttl   Setup the TTL for this item. Default: <Entry TTL>
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    put(
        data: T,
        ttl?: number
    ): Promise<boolean>;

    /**
     * Mark a piece of resource item NEVER-EXISTED.
     *
     * @param entry      The entry of resource items to be marked.
     * @param identity   The identity of resource items to be marked.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    markNeverExist(
        entry: string,
        identity: Partial<T>
    ): Promise<boolean>;

    /**
     * Mark a piece of resource item NEVER-EXISTED.
     *
     * @param entry      The entry of resource items to be marked.
     * @param identities The identity of resource items to be marked.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    markMultiNeverExist(
        entry: string,
        identities: Array<Partial<T>>
    ): Promise<boolean>;

    /**
     * Write multiple pieces of cache items into cache.
     *
     * @param data  The key-value dictionary of resource items to be written.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the resource item has been written into cache successfully if
     *  the promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    putMulti(
        data: T[]
    ): Promise<boolean>;

    /**
     * Check if a resouce item exists in cache.
     *
     * @param key The key of cache item to be check.
     * @return
     *  Return a Promise with the result of following possible values:
     *  undefined, if that the data is marked NEVER-EXISTED.
     *  true, if the cache item of data exists.
     *  false, if the cache item doesn't exist.
     */
    exists(
        entry: string,
        identity: Partial<T>
    ): Promise<boolean | undefined>;

    /**
     * Remove a piece of resource item from cache.
     *
     * @param entry The entry of resource items to be removed.
     * @param key   The key of resource item to be removed.
     * @returns
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  The promise-result will be TRUE if the resource item is deleted or it
     *  doesn't exist. Otherwise the promise-result will be FALSE.
     */
    remove(
        entry: string,
        identity: Partial<T>
    ): Promise<boolean>;

    /**
     * Remove a piece of resource item from cache.
     *
     * @param entry The entry of resource items to be removed.
     * @param key   The keys list of resource items to be removed.
     * @returns
     *
     *  Returns a Promise including a number-type result.
     *
     *  The promise-result tells how many items in cache has been deleted.
     */
    removeMulti(
        entry: string,
        identity: Array<Partial<T>>
    ): Promise<number>;

    /**
     * Flush all the cache of a resource item.
     *
     * @param data              The resource item to be flush.
     * @param includeAttachment Flush attachment also. Default: false
     */
    flush(
        data: T,
        includeAttachment?: boolean
    ): Promise<boolean>;
}

export interface IResourceHub {

    /**
     * Add a new cache driver into hub.
     *
     * @param name      The name of cache driver.
     * @param driver    The cache driver object.
     */
    addDriver(name: string, driver: IDriver): this;

    /**
     * Create a new zone for a resource.
     *
     * @param name          The unique name of resource zone.
     * @param dirver        The name of cache driver to be used.
     * @param serializer    The serializer of resource data.
     * @param unserializer  The unserialize of resource data.
     */
    createZone<T>(
        name: string,
        dirver: string,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>
    ): IResourceZone<T>;

    /**
     * Get a created resource zone.
     *
     * @param name The unique name of resource zone.
     */
    getZone<T>(
        name: string,
    ): IResourceZone<T>;
}

export interface IDriver {

    /**
     * Check if a cache item exists.
     *
     * @param key The key of cache item to be check.
     * @return
     *
     *  Return a Promise with the result of following possible values:
     *
     *  - undefined, if that the data is marked NEVER-EXISTED.
     *  - true, if the cache item of data exists.
     *  - false, if the item is not found in cache.
     */
    exists(key: string): Promise<boolean | undefined>;

    /**
     * Fetch a piece of cache item by its key.
     *
     * @param key The key of cache item to be fetched.
     * @return
     *
     *  Return a Promise with the result of following possible values:
     *
     *  - undefined, if that the data is marked NEVER-EXISTED.
     *  - Buffer or String, if the cache item of data exists.
     *  - null, if the item is not found in cache.
     */
    get(key: string): AsyncNullable<CacheBody>;

    /**
     * Fetch multiple pieces of cache items by their keys.
     *
     * @param keys The array of keys of cache items to be fetched.
     * @return
     *
     *  Return a Promise with the result of a dictionary of following possible
     *  values:
     *
     *  - undefined, if that the data is marked NEVER-EXISTED.
     *  - Buffer or String, if the cache item of data exists.
     *  - null, if the item is not found in cache.
     */
    getMulti(keys: string[]): Promise<Record<string, Nullable<CacheBody>>>;

    /**
     * Write a piece of cache item into cache.
     *
     * @param key   The key of cache item to be written.
     * @param data  The data of cache item to be written.
     * @param ttl   The TTL of cache item to be written, in seconds.
     *
     *  If the **data** is set to undefined, it means the data is
     *  NEVER-EXISTED in the reality.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the cache item has been written into cache successfully if the
     *  promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    set(key: string, data: CacheBody, ttl: number): Promise<boolean>;

    /**
     * Write multiple pieces of cache items into cache.
     *
     * @param data  The key-value dictionary of cache item to be written.
     * @param ttl   The TTL of cache item to be written, in seconds.
     *
     *  If any item in the **data** is set to undefined, it means the item
     *  is NEVER-EXISTED in the reality.
     *
     * @return
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  It means the cache item has been written into cache successfully if the
     *  promise-result is TRUE. Otherwise a FALSE value is return as the
     *  promise-result.
     */
    setMulti(data: Record<string, CacheBody>, ttl: number): Promise<boolean>;

    /**
     * Remove a piece of cache item from cache.
     *
     * @param key   The key of cache item to be removed.
     * @returns
     *
     *  Returns a Promise including a boolean-type result.
     *
     *  The promise-result will be TRUE if the cache item is deleted or it
     *  doesn't exist. Otherwise the promise-result will be FALSE.
     */
    remove(key: string): Promise<boolean>;

    /**
     * Remove multiple pieces of cache items from cache.
     *
     * @param key   The keys list of cache item to be removed.
     * @returns
     *
     *  Returns a Promise including a number-type result.
     *
     *  The promise-result tells how many items in cache has been deleted.
     */
    removeMulti(keys: string[]): Promise<number>;

    /**
     * Tell if the cache is usable now.
     */
    usable(): boolean;
}
