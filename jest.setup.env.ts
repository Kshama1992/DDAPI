import App from './src/app';
import { DataSource } from 'typeorm/data-source/DataSource';
import MainDataSource from './src/main-data-source';

let app: any;
let connection: DataSource;

// @ts-ignore
beforeAll(async () => {
	app = new App();
	connection = await MainDataSource.initialize();
});

// @ts-ignore
afterAll(async () => {
	app.close();
	if (connection) await connection.destroy();
});

export { app };
