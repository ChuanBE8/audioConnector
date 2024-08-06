import dotenv from 'dotenv';
import { Server } from './websocket/server';

console.log('Starting service.');
console.log('Test Add Git');

dotenv.config();
new Server().start();