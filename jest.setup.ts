if (!process.env.hasOwnProperty('POSTGRES_HOST') || process.env.POSTGRES_HOST !== 'localhost') {
	process.env.POSTGRES_HOST = 'localhost';
	process.env.POSTGRES_DB = 'testing_db';
	process.env.POSTGRES_USER = 'testing_user';
	process.env.POSTGRES_PASSWORD = 'any_test_pass';
}

jest.setTimeout(400000); // in milliseconds
