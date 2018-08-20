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
    IFactory,
    IZone,
    ISerializer,
    IUnserializer,
    IDriver
} from "./common";
import { createZone } from "./Zone";

class Factory
implements IFactory {

    private _drivers: Record<string, IDriver>;

    private _zones: Record<string, IZone<any>>;

    public constructor() {

        this._drivers = {};

        this._zones = {};
    }

    public addDriver(name: string, driver: IDriver): this {

        if (this._drivers[name]) {

            throw new Error(`Cache driver "${name}" already exists.`);
        }

        this._drivers[name] = driver;

        return this;
    }

    public createZone<T>(
        name: string,
        driver: string,
        serializer: ISerializer<T>,
        unserializer: IUnserializer<T>
    ): IZone<T> {

        if (this._zones[name]) {

            throw new Error(`Resource zone "${name}" already exists.`);
        }

        if (!this._drivers[driver]) {

            throw new Error(`Cache driver "${driver}" doesn't exist.`);
        }

        return this._zones[name] = createZone<T>(
            name,
            this._drivers[driver],
            serializer,
            unserializer
        );
    }

    public getZone<T>(
        name: string,
    ): IZone<T> {

        if (!this._zones[name]) {

            throw new Error(`Resource zone "${name}" doesn't exist.`);
        }

        return this._zones[name];
    }
}

/**
 * @deprecated Use createFactory instead.
 */
export function createHub(): IFactory {

    return new Factory();
}

export function createFactory(): IFactory {

    return new Factory();
}
