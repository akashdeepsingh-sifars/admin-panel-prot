import type { Driver, Org } from '../types';

export const NOW = '2026-09-29T12:00:00.000Z';

export const SHIPPERS: Org[] = [
  {
    id: 'org-s1',
    name: 'Northwind Foods',
    contact: { id: 'u-s1', name: 'Hannah Brooks', phone: '+1 312 555 0142', email: 'hbrooks@northwindfoods.example' },
  },
  {
    id: 'org-s2',
    name: 'Bluebird Retail',
    contact: { id: 'u-s2', name: 'Tomas Alvarez', phone: '+1 206 555 0177', email: 'talvarez@bluebird.example' },
  },
];

export const CARRIERS: Org[] = [
  {
    id: 'org-c1',
    name: 'Redline Freight',
    contact: { id: 'u-c1', name: 'Dana Whitfield', phone: '+1 214 555 0103', email: 'dana@redlinefreight.example' },
  },
  {
    id: 'org-c2',
    name: 'Summit Haulage',
    contact: { id: 'u-c2', name: 'Priya Raman', phone: '+1 404 555 0188', email: 'priya@summithaulage.example' },
  },
];

export const DRIVERS: Driver[] = [
  {
    id: 'drv-1',
    name: 'Marcus Reed',
    phone: '+1 312 555 0111',
    email: 'mreed@redlinefreight.example',
    orgId: 'org-c1',
    device: 'Pixel 8 · Android 15',
    shipmentsCompleted: 212,
  },
  {
    id: 'drv-2',
    name: 'Ivan Petrov',
    phone: '+1 214 555 0122',
    email: 'ipetrov@redlinefreight.example',
    orgId: 'org-c1',
    device: 'Galaxy A14 · Android 13',
    shipmentsCompleted: 64,
  },
  {
    id: 'drv-3',
    name: 'Lena Ortiz',
    phone: '+1 404 555 0133',
    email: 'lortiz@summithaulage.example',
    orgId: 'org-c2',
    device: 'iPhone 14 · iOS 18',
    shipmentsCompleted: 148,
  },
  {
    id: 'drv-4',
    name: 'Sam Okafor',
    phone: '+1 615 555 0144',
    email: 'sokafor@summithaulage.example',
    orgId: 'org-c2',
    device: 'iPhone 12 · iOS 17',
    shipmentsCompleted: 97,
  },
];

export const ADMINS = ['Bharat Shah', 'Akashdeep Singh', 'Rhea Kapoor'];
