/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as constants from "../constants.js";
import type * as coupons from "../coupons.js";
import type * as customers from "../customers.js";
import type * as eventLists from "../eventLists.js";
import type * as events from "../events.js";
import type * as migrations_addSlugsToEvents from "../migrations/addSlugsToEvents.js";
import type * as organizations from "../organizations.js";
import type * as pendingEmails from "../pendingEmails.js";
import type * as promoters from "../promoters.js";
import type * as storage from "../storage.js";
import type * as ticketTypes from "../ticketTypes.js";
import type * as tickets from "../tickets.js";
import type * as transactions from "../transactions.js";
import type * as transfers from "../transfers.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  constants: typeof constants;
  coupons: typeof coupons;
  customers: typeof customers;
  eventLists: typeof eventLists;
  events: typeof events;
  "migrations/addSlugsToEvents": typeof migrations_addSlugsToEvents;
  organizations: typeof organizations;
  pendingEmails: typeof pendingEmails;
  promoters: typeof promoters;
  storage: typeof storage;
  ticketTypes: typeof ticketTypes;
  tickets: typeof tickets;
  transactions: typeof transactions;
  transfers: typeof transfers;
  users: typeof users;
  validators: typeof validators;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
