import { TestInt401Method, TestInt403Method, TestIntUpdate404Method } from '@controller/__tests__/base-service.spec';
import { TestReservation, TestSubscription } from '@utils/tests/base-data';
import ReservationEntity from '@entity/reservation.entity';
import MainDataSource from '@src/main-data-source';

const url = '/reservation';

beforeAll(async () => {
	await MainDataSource.getRepository(ReservationEntity).save(MainDataSource.getRepository(ReservationEntity).create(TestReservation));
});

describe('ROUTE: /reservation', () => {
	it('GET should return 403', async () => {
		await TestInt403Method({ id: 9999, url, entity: ReservationEntity, asSuperAdmin: true });
	});

	it('GET LIST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'get', entity: ReservationEntity });
	});

	it('PUT should return 404', async () => {
		await TestIntUpdate404Method({ id: 9999, url, method: 'put', entity: ReservationEntity, asSuperAdmin: true });
	});

	// TODO
	// it('PUT should return 200', async () => {
	// 	await TestIntUpdateMethod({ id: 9999, url, method: 'put', entity: ReservationEntity, asSuperAdmin: true });
	// });

	it('PUT should return 401 for not authorized user', async () => {
		await TestInt401Method({ id: 9999, url, method: 'put', entity: ReservationEntity });
	});

	it('POST should return 401 for not authorized user', async () => {
		await TestInt401Method({ url, method: 'post', entity: ReservationEntity });
	});

	it('POST should return 403', async () => {
		await TestInt403Method({ method: 'post', url, entity: ReservationEntity, asSuperAdmin: true });
	});

	it('DELETE should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestSubscription.id, url, method: 'delete', entity: ReservationEntity });
	});

	it('DELETE should return 403', async () => {
		await TestInt403Method({
			id: TestReservation.id,
			url,
			method: 'delete',
			entity: ReservationEntity,
			asSuperAdmin: true,
			errorMessage: 'Cant delete reservation!',
		});
	});

	it('DELETE should return 404', async () => {
		await TestIntUpdate404Method({
			id: 9999,
			url,
			method: 'delete',
			entity: ReservationEntity,
			asSuperAdmin: true,
		});
	});
});
