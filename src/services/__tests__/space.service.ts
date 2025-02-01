import { faker } from '@faker-js/faker';
import MainDataSource from '@src/main-data-source';
import { Repository } from 'typeorm/repository/Repository';
import { SpaceService } from '@src/services';
import SpaceEntity from '@entity/space.entity';
import SpaceStatus from 'dd-common-blocks/dist/type/SpaceStatus';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import ChargeVariant from 'dd-common-blocks/dist/type/ChargeVariant';
import PackageShow from 'dd-common-blocks/dist/type/PackageShow';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import dayjs, { Dayjs } from 'dayjs';
import ReservationEntity from '@entity/reservation.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import Weekdays from 'dd-common-blocks/dist/type/WeekdaysType';
import { CreateQueryBuilderMock } from '@utils/tests/typeorm.mock';
import { Between, In } from 'typeorm';
import GetSpaceAvailabilityDto from '@src/dto/get-space-availability.dto';
import UserService from '@services/user.service';
import SubscriptionEntity from '@entity/subscription.entity';
import { TestInvoice, TestSubscription } from '@utils/tests/base-data';
import UserEntity from '@entity/user.entity';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import InvoiceEntity from '@entity/invoice.entity';
import SubscriptionService from '@services/subscription.service';
import EntityStatus from 'dd-common-blocks/dist/type/EntityStatus';
import SpaceFilter from 'dd-common-blocks/dist/interface/filter/space-filter.interface';
import VenueStatus from 'dd-common-blocks/dist/type/VenueStatus';

jest.mock('@services/user.service');
jest.mock('@services/invoice.service');
jest.mock('@services/subscription.service');

let thisService: SpaceService;

const generateVenueCustomAccess = () => {
	const weekdays = Object.values(Weekdays);
	return Array.from({ length: 7 }).map((_, i) => ({
		open: true,
		accessHoursFrom: '08:00:00',
		accessHoursTo: '16:00:00',
		weekday: weekdays[i],
	}));
};

// @ts-ignore
const space: SpaceEntity = {
	id: Number(faker.random.numeric(2)),
	name: faker.random.words(5),
	alias: faker.internet.domainName(),
	credits2x: false,
	creditsHalf: false,
	notAllowCredit: false,
	access247: false,
	hideQuantity: false,
	quantityUnlimited: false,
	securityDeposit: false,
	billCycleStart: Number(faker.random.numeric(1)),
	roundHours: Number(faker.random.numeric(2)),
	customAdditionalTime: Number(faker.random.numeric(2)),
	venueId: Number(faker.random.numeric(2)),
	spaceTypeId: Number(faker.random.numeric(2)),
	updatedById: Number(faker.random.numeric(2)),
	createdById: Number(faker.random.numeric(2)),
	quantityRepublish: Number(faker.random.numeric(2)),
	quantityRepublishCustom: Number(faker.random.numeric(2)),
	usedQuantity: Number(faker.random.numeric(2)),
	price: Number(faker.random.numeric(3)),
	tax: Number(faker.random.numeric(2)),
	securityDepositPrice: Number(faker.random.numeric(2)),
	quantity: Number(faker.random.numeric(4)),
	capacity: Number(faker.random.numeric(4)),
	status: SpaceStatus.PUBLISH,
	chargeType: ChargeType.MONTHLY,
	chargeVariant: ChargeVariant.byRoundHours,
	packageShow: PackageShow.PUBLIC,
	lastUsed: faker.date.recent(10),
	description: faker.lorem.paragraphs(2),
	gettingStarted: faker.lorem.paragraphs(2),
	createdAt: faker.date.recent(10),
	updatedAt: faker.date.recent(10),
	renewedAt: faker.date.recent(10),
	spaceType: {
		logicType: SpaceTypeLogicType.MONTHLY,
		name: faker.lorem.words(3),
		alias: faker.lorem.words(3),
		createdAt: faker.date.recent(10),
		updatedAt: faker.date.recent(10),
		id: Number(faker.random.numeric(2)),
	},
	// @ts-ignore
	venue: {
		tzId: 'America/New_York',
	},
	photos: [{ url: faker.internet.avatar(), name: 'name', id: Number(faker.random.numeric(2)), createdAt: new Date(), updatedAt: new Date() }],
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

const reservation: ReservationEntity = {
	id: Number(faker.random.numeric(2)),
	createdAt: faker.date.recent(10),
	updatedAt: faker.date.recent(10),
	isCheckin: false,
	tzLocation: '',
	price: Number(faker.random.numeric(3)),
	updatedById: Number(faker.random.numeric(2)),
	createdById: Number(faker.random.numeric(2)),
	hoursFrom: '2021-10-27 21:00:00.000000 +00:00',
	status: ReservationStatus.ACTIVE,
	spaceId: space.id,
	venueId: Number(faker.random.numeric(2)),
	userId: Number(faker.random.numeric(2)),
	chargeType: space.chargeType,
};

describe('SERVICE: Space Service', () => {
	// @ts-ignore
	let repo: Repository<SpaceEntity>;
	let reservationRepo: Repository<ReservationEntity>;
	let invoiceStatusRepo: Repository<InvoiceStatusEntity>;
	let invoiceRepo: Repository<InvoiceEntity>;
	let subscriptionRepo: Repository<SubscriptionEntity>;

	beforeAll(() => {
		thisService = new SpaceService(new SubscriptionService());
	});

	beforeEach(() => {
		subscriptionRepo = MainDataSource.getRepository(SubscriptionEntity);
		reservationRepo = MainDataSource.getRepository(ReservationEntity);
		invoiceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);
		invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		repo = MainDataSource.getRepository(SpaceEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(space);
		reservationRepo.createQueryBuilder = CreateQueryBuilderMock(reservation);
		subscriptionRepo.createQueryBuilder = CreateQueryBuilderMock(TestSubscription);
	});

	describe('Get space availability', () => {
		beforeAll(async () => {});

		describe('getOpenTimes', () => {
			const dateFrom = dayjs().startOf('day');
			const dateTo = dayjs().endOf('day');
			it('should return empty array for same dates', () => {
				const result = thisService.getOpenTimes({ from: dateFrom, to: dateFrom, space, reservations: [reservation] });
				expect(result).toBeInstanceOf(Array);
				expect(result).toHaveLength(0);
			});

			it('should return 48 items', () => {
				const result = thisService.getOpenTimes({ from: dateFrom, to: dateTo, space, reservations: [reservation] });
				expect(result).toBeInstanceOf(Array);
				expect(result).toHaveLength(48);
				expect(result).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							value: expect.any(String),
							isMinTime: expect.any(Boolean),
							reserved: expect.any(Boolean),
						}),
					])
				);
			});

			it('first and second values must be equal to dateFrom and dateTo', () => {
				const result = thisService.getOpenTimes({ from: dateFrom, to: dateTo, space, reservations: [reservation] });
				expect(result[0].value).toEqual(dateFrom.format());
				expect(result[result.length - 1].value).toEqual(dateTo.subtract(30, 'minutes').add(1, 's').format());
			});
		});

		describe('getSpaceAvailableHoursByDate', () => {
			describe('hide passed reservations', () => {
				const params247 = {
					is247: true,
					tzId: 'America/New_York',
					space,
					reservations: [reservation],
					inputDate: dayjs(),
				};

				const paramsHoursCustom = {
					is247: false,
					tzId: 'America/New_York',
					space: {
						...space,
						venue: {
							tzId: 'America/New_York',
							accessOpen: true,
							accessCustom: true,
							accessCustomData: generateVenueCustomAccess(),
						},
					},
					reservations: [reservation],
					inputDate: dayjs(),
				};

				const paramsHoursRegular = {
					is247: false,
					tzId: 'America/New_York',
					space: {
						...space,
						venue: {
							tzId: 'America/New_York',
							accessOpen: true,
							accessCustom: false,
							accessHoursFrom: '09:00:00',
							accessHoursTo: '17:00:00',
						},
					},
					reservations: [reservation],
					inputDate: dayjs(),
				};

				function testThisBase({ expectedItemsLength, result, testDate }: { expectedItemsLength: number; result: any; testDate: Dayjs }) {
					expect(result.date).toBe(testDate.format('YYYY-MM-DD'));
					expect(result.open).toBe(true);
					expect(result.reserved).toBe(false);

					expect(result.items).toBeInstanceOf(Array);
					expect(result.items).toHaveLength(expectedItemsLength);
				}

				beforeEach(() => {
					jest.useFakeTimers();
				});

				describe('values should start with 13:00 when real time 12:50', () => {
					const testDate = dayjs.tz('2018-11-11 12:50:00', params247.tzId);

					beforeEach(() => {
						jest.setSystemTime(testDate.valueOf());
						params247.inputDate = dayjs();
						paramsHoursCustom.inputDate = dayjs();
						paramsHoursRegular.inputDate = dayjs();
					});

					it('access 24/7', () => {
						const result = thisService.getSpaceAvailableHoursByDate(params247);
						testThisBase({ result, expectedItemsLength: 22, testDate });
						expect(result.items[0].value).toEqual(testDate.add(10, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							testDate.endOf('day').subtract(30, 'minutes').add(1, 's').format()
						);

						expect(result.from).toBe(testDate.add(10, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe('23:59:59');
					});

					it('venue access custom (working hours 08:00-16:00)', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursCustom);

						testThisBase({ result, expectedItemsLength: 6, testDate });

						expect(result.items[0].value).toEqual(testDate.add(10, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs
								.tz(generateVenueCustomAccess()[6].accessHoursTo, 'HH:mm:ss', paramsHoursCustom.tzId)
								.subtract(30, 'minutes')
								.format()
						);

						expect(result.from).toBe(testDate.add(10, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(generateVenueCustomAccess()[6].accessHoursTo);
					});

					it('venue access regular', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursRegular);

						testThisBase({ result, expectedItemsLength: 8, testDate });

						expect(result.items[0].value).toEqual(testDate.add(10, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs
								.tz(paramsHoursRegular.space.venue.accessHoursTo, 'HH:mm:ss', paramsHoursRegular.tzId)
								.subtract(30, 'minutes')
								.format()
						);

						expect(result.from).toBe(testDate.add(10, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(paramsHoursRegular.space.venue.accessHoursTo);
					});
				});

				describe('values should start with 12:30 when real time 12:45', () => {
					const testDate = dayjs.tz('2018-11-11 12:45:00', params247.tzId);

					beforeEach(() => {
						jest.setSystemTime(testDate.valueOf());
						params247.inputDate = dayjs();
						paramsHoursCustom.inputDate = dayjs();
						paramsHoursRegular.inputDate = dayjs();
					});

					it('access 24/7', () => {
						const result = thisService.getSpaceAvailableHoursByDate(params247);
						testThisBase({ result, expectedItemsLength: 23, testDate });
						expect(result.items[0].value).toEqual(testDate.subtract(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							testDate.endOf('day').subtract(30, 'minutes').add(1, 's').format()
						);

						expect(result.from).toBe(testDate.subtract(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe('23:59:59');
					});

					it('venue access custom (working hours 08:00-16:00)', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursCustom);

						testThisBase({ result, expectedItemsLength: 8, testDate });

						expect(result.items[0].value).toEqual(testDate.subtract(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(generateVenueCustomAccess()[6].accessHoursTo, 'HH:mm:ss', paramsHoursCustom.tzId).format()
						);

						expect(result.from).toBe(testDate.subtract(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(generateVenueCustomAccess()[6].accessHoursTo);
					});

					it('venue access regular', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursRegular);

						testThisBase({ result, expectedItemsLength: 10, testDate });

						expect(result.items[0].value).toEqual(testDate.subtract(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(paramsHoursRegular.space.venue.accessHoursTo, 'HH:mm:ss', paramsHoursRegular.tzId).format()
						);

						expect(result.from).toBe(testDate.subtract(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(paramsHoursRegular.space.venue.accessHoursTo);
					});
				});

				describe('values should start with 12:30 when real time 12:15', () => {
					const testDate = dayjs.tz('2018-11-11 12:15:00', params247.tzId);

					beforeEach(() => {
						jest.setSystemTime(testDate.valueOf());
						params247.inputDate = dayjs();
						paramsHoursCustom.inputDate = dayjs();
						paramsHoursRegular.inputDate = dayjs();
					});

					it('access 24/7', () => {
						const result = thisService.getSpaceAvailableHoursByDate(params247);
						testThisBase({ result, expectedItemsLength: 23, testDate });
						expect(result.items[0].value).toEqual(testDate.add(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							testDate.endOf('day').subtract(30, 'minutes').add(1, 's').format()
						);

						expect(result.from).toBe(testDate.add(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe('23:59:59');
					});

					it('venue access custom (working hours 08:00-16:00)', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursCustom);

						testThisBase({ result, expectedItemsLength: 8, testDate });

						expect(result.items[0].value).toEqual(testDate.add(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(generateVenueCustomAccess()[6].accessHoursTo, 'HH:mm:ss', paramsHoursCustom.tzId).format()
						);

						expect(result.from).toBe(testDate.add(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(generateVenueCustomAccess()[6].accessHoursTo);
					});

					it('venue access regular', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursRegular);

						testThisBase({ result, expectedItemsLength: 10, testDate });

						expect(result.items[0].value).toEqual(testDate.add(15, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(paramsHoursRegular.space.venue.accessHoursTo, 'HH:mm:ss', paramsHoursRegular.tzId).format()
						);

						expect(result.from).toBe(testDate.add(15, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(paramsHoursRegular.space.venue.accessHoursTo);
					});
				});

				describe('values should start with 12:00 when real time 12:05', () => {
					const testDate = dayjs.tz('2018-11-11 12:05:00', params247.tzId);

					beforeEach(() => {
						jest.setSystemTime(testDate.valueOf());
						params247.inputDate = dayjs();
						paramsHoursCustom.inputDate = dayjs();
						paramsHoursRegular.inputDate = dayjs();
					});

					it('access 24/7', () => {
						const result = thisService.getSpaceAvailableHoursByDate(params247);
						testThisBase({ result, expectedItemsLength: 24, testDate });
						expect(result.items[0].value).toEqual(testDate.subtract(5, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							testDate.endOf('day').subtract(30, 'minutes').add(1, 's').format()
						);

						expect(result.from).toBe(testDate.subtract(5, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe('23:59:59');
					});

					it('venue access custom (working hours 08:00-16:00)', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursCustom);

						testThisBase({ result, expectedItemsLength: 9, testDate });

						expect(result.items[0].value).toEqual(testDate.subtract(5, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(generateVenueCustomAccess()[6].accessHoursTo, 'HH:mm:ss', paramsHoursCustom.tzId).format()
						);

						expect(result.from).toBe(testDate.subtract(5, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(generateVenueCustomAccess()[6].accessHoursTo);
					});

					it('venue access regular', () => {
						// @ts-ignore
						const result = thisService.getSpaceAvailableHoursByDate(paramsHoursRegular);

						testThisBase({ result, expectedItemsLength: 11, testDate });

						expect(result.items[0].value).toEqual(testDate.subtract(5, 'minutes').format());
						expect(result.items[result.items.length - 1].value).toEqual(
							dayjs.tz(paramsHoursRegular.space.venue.accessHoursTo, 'HH:mm:ss', paramsHoursRegular.tzId).format()
						);

						expect(result.from).toBe(testDate.subtract(5, 'minutes').format('HH:mm:ss'));
						expect(result.to).toBe(paramsHoursRegular.space.venue.accessHoursTo);
					});
				});
			});
		});

		describe('getAvailable', () => {
			const params: GetSpaceAvailabilityDto = { userId: faker.random.numeric(2), startDate: '2018-11-11', endDate: '2018-11-18' };
			it('should return repo call with valid params and call "getSpaceAvailableHoursByDate"', async () => {
				const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockResolvedValue(Promise.resolve(space));
				const getUserSubsSpy = jest.spyOn(UserService as any, '_getSubscriptionsByUserId').mockReturnValue([]);
				const getSpaceAvailableHoursByDateSpy = jest.spyOn(thisService, 'getSpaceAvailableHoursByDate');

				await thisService.getAvailable(space.id, params);

				const startDateObj = dayjs(params.startDate, 'YYYY-MM-DD').startOf('d').tz(space.venue.tzId, true);
				const endDateObj = dayjs(params.endDate, 'YYYY-MM-DD').endOf('d').tz(space.venue.tzId, true);

				expect(findOneOrFailSpy).toBeCalled();
				expect(findOneOrFailSpy).toBeCalledWith({
					where: { id: space.id },
					relations: ['venue', 'venue.accessCustomData', 'spaceType'],
				});

				expect(getUserSubsSpy).toBeCalled();
				expect(getUserSubsSpy).toBeCalledWith(params.userId, []);

				expect(reservationRepo.createQueryBuilder().where).toHaveBeenCalled();
				expect(reservationRepo.createQueryBuilder().where).toHaveBeenCalledWith([
					{
						hoursFrom: Between(startDateObj.toDate(), endDateObj.toDate()),
						spaceId: space.id,
						status: ReservationStatus.ACTIVE,
					},
					{
						hoursTo: Between(startDateObj.toDate(), endDateObj.toDate()),
						spaceId: space.id,
						status: ReservationStatus.ACTIVE,
					},
				]);
				expect(reservationRepo.createQueryBuilder().getMany).toHaveBeenCalled();

				expect(getSpaceAvailableHoursByDateSpy).toHaveBeenCalledTimes(8);
			});
		});
	});

	describe('delete space', () => {
		it('should throw error if shave have reservations', async () => {
			const spaceId = Number(faker.random.numeric(2));
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockResolvedValue(Promise.resolve(space));

			try {
				await thisService.delete(spaceId);

				expect(findOneOrFailSpy).toBeCalledWith({ where: { id: spaceId }, relations: { venue: true } });

				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(2);
				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, 'Reservation.spaceId = :id', { id: spaceId });
				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'Reservation.status = :status', {
					status: ReservationStatus.ACTIVE,
				});
				expect(reservationRepo.createQueryBuilder().getCount).toBeCalled();
			} catch (e) {
				expect((e as Error).message).toBe("Can't delete: Space has active reservations!");
			}
		});

		it('should throw error if shave have invoices', async () => {
			const spaceId = Number(faker.random.numeric(2));
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockResolvedValue(Promise.resolve(space));
			const invoiceStatusFindSpy = jest.spyOn(invoiceStatusRepo, 'find').mockResolvedValue(Promise.resolve([]));
			// @ts-ignore
			const invoiceFindSpy = jest.spyOn(invoiceRepo, 'find').mockResolvedValue(Promise.resolve([TestInvoice]));

			reservationRepo.createQueryBuilder().getCount = jest.fn().mockReturnValue(0);

			try {
				await thisService.delete(spaceId);

				expect(findOneOrFailSpy).toBeCalledWith({ where: { id: spaceId }, relations: { venue: true } });

				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(2);
				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, 'Reservation.spaceId = :id', { id: spaceId });
				expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'Reservation.status = :status', {
					status: ReservationStatus.ACTIVE,
				});
				expect(reservationRepo.createQueryBuilder().getCount).toBeCalled();

				expect(invoiceStatusFindSpy).toBeCalledWith({
					where: [{ name: 'Upcoming' }, { name: 'Upcoming-Hours' }],
					select: ['id'],
				});

				expect(invoiceFindSpy).toBeCalledWith({
					where: { spaceId: Number(spaceId), invoiceStatus: In([]) },
				});
			} catch (e) {
				expect((e as Error).message).toBe('Cannot be deleted, has invoices attached!');
			}
		});

		it('should check reservations, invoices and subscriptions and change status to "DELETED"', async () => {
			const spaceId = Number(faker.random.numeric(2));
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockResolvedValue(Promise.resolve(space));
			const saveSpy = jest.spyOn(repo, 'save').mockReturnValue(Promise.resolve(space));
			const invoiceStatusFindSpy = jest.spyOn(invoiceStatusRepo, 'find').mockResolvedValue(Promise.resolve([]));
			const invoiceFindSpy = jest.spyOn(invoiceRepo, 'find').mockResolvedValue(Promise.resolve([]));

			reservationRepo.createQueryBuilder().getCount = jest.fn().mockReturnValue(0);
			await thisService.delete(spaceId);

			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: spaceId }, relations: { venue: true } });

			expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(2);
			expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, 'Reservation.spaceId = :id', { id: spaceId });
			expect(reservationRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'Reservation.status = :status', {
				status: ReservationStatus.ACTIVE,
			});
			expect(reservationRepo.createQueryBuilder().getCount).toBeCalled();

			expect(invoiceStatusFindSpy).toBeCalledWith({
				where: [{ name: 'Upcoming' }, { name: 'Upcoming-Hours' }],
				select: ['id'],
			});

			expect(invoiceFindSpy).toBeCalledWith({
				where: { spaceId: Number(spaceId), invoiceStatus: In([]) },
			});

			expect(subscriptionRepo.createQueryBuilder().andWhere).toHaveBeenCalledTimes(3);
			expect(subscriptionRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(1, 'Subscription.spaceId = :id', { id: spaceId });
			expect(subscriptionRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'Subscription.status = :status', {
				status: EntityStatus.ACTIVE,
			});
			expect(subscriptionRepo.createQueryBuilder().andWhere).toHaveBeenNthCalledWith(3, 'Subscription.isOngoing = :isOngoing', {
				isOngoing: true,
			});
			expect(subscriptionRepo.createQueryBuilder().getMany).toBeCalled();

			expect(saveSpy).toBeCalledWith({ ...space, status: SpaceStatus.DELETED });
		});
	});

	describe('list methods', () => {
		const params: SpaceFilter = {
			withReservations: true,
			withCreditHours: true,
			withPackageSpaceTypes: true,
			withPackageVenueTypes: true,
			withPackageBrands: true,
			withPackageVenues: true,
			withAmenities: true,
			withCreatedBy: true,
			withUpdatedBy: true,
			venueStatus: VenueStatus.PUBLISH,
			chargeType: ChargeType.MONTHLY,
			chargeTypes: [ChargeType.MONTHLY],
			packageShow: [PackageShow.PUBLIC],
			searchString: faker.random.words(2),
			address: faker.random.words(2),
			brandId: Number(faker.random.numeric(2)),
			venueId: Number(faker.random.numeric(2)),
			spaceTypeId: Number(faker.random.numeric(2)),
			spaceTypeIds: [Number(faker.random.numeric(2))],
			excludeIds: [Number(faker.random.numeric(2))],
			capacity: Number(faker.random.numeric(2)),
			quantity: Number(faker.random.numeric(2)),
			radius: 300,
			longitude: faker.address.longitude(),
			latitude: faker.address.latitude(),
			limit: 10,
			offset: 0,
		};

		it('_baseList should return SelectQueryBuilder object with all valid parameters', async () => {
			await thisService._baseList(params,false);
			const queryBuilder = repo.createQueryBuilder();

			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'Space.spaceType', 'spaceType');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'Space.photos', 'photos');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'Space.eventData', 'eventData');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(4, 'Space.venue', 'venue');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(5, 'venue.brand', 'brand');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(6, 'venue.photos', 'venuePhotos');
            expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(7, 'venue.logo', 'venueLogo');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(8, 'venue.accessCustomData', 'accessCustomData');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(9, 'accessCustomData.venue', 'accessCustomDataVenue');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
				10,
				'Space.reservation',
				'reservation',
				`reservation.status = :reservationStatus`,
				{
					reservationStatus: ReservationStatus.ACTIVE,
				}
			);
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(11, 'Space.creditHours', 'creditHours');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(12, 'Space.packageSpaceTypes', 'packageSpaceTypes');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(13, 'Space.packageVenueTypes', 'packageVenueTypes');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(14, 'Space.packageBrands', 'packageBrands');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(15, 'Space.packageVenues', 'packageVenues');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(16, 'Space.amenities', 'amenities');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(17, 'amenities.amenity', 'amenities.amenity');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(18, 'Space.createdBy', 'createdBy');
			expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(19, 'Space.updatedBy', 'updatedBy');

			expect(queryBuilder.loadRelationCountAndMap).toHaveBeenCalledWith('Space.reservationCount', 'Space.reservation');

			expect(queryBuilder.where).toHaveBeenCalledWith(`LOWER(Space.name) LIKE LOWER(:searchString)`, {
				searchString: `%${params.searchString}%`,
			});

			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(1, `venue.brandId IN (:...brandIdArr)`, { brandIdArr: [params.brandId] });
			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(2, `Space.venueId IN (:...venueIdArr)`, { venueIdArr: [params.venueId] });
			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(3, `1=1`, { venueTypesIdArr: [] });
			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(4, `Space.spaceTypeId IN (:...spaceTypesIdArr)`, {
				spaceTypesIdArr: params.spaceTypeIds,
			});
			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(5, `LOWER(venue.address) LIKE LOWER(:address)`, { address: `%${params.address}%` });
			expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
				6,
				'ST_Distance(venue.coordinates, ST_SetSRID(ST_GeomFromGeoJSON(:origin), ST_SRID(venue.coordinates))) <= :radius',
				{ origin: `{"type":"Point","coordinates":["${params.longitude}","${params.latitude}"]}`, radius: params.radius }
			);

			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(1, `Space.alias = :alias`, { alias: undefined });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(2, `venue.alias = :venueAlias`, { venueAlias: undefined });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(3, `Space.status = :status`, { status: undefined });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(4, `venue.status = :venueStatus`, { venueStatus: params.venueStatus });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(5, `Space.spaceType = :spaceTypeId`, { spaceTypeId: params.spaceTypeId });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(6, `Space.id NOT IN (:...excludeIds)`, { excludeIds: params.excludeIds });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(7, `Space.capacity = :capacity`, { capacity: params.capacity });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(8, `Space.quantity = :quantity`, { quantity: params.quantity });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(9, `Space.chargeType = :chargeType`, { chargeType: params.chargeType });
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(10, `Space.chargeType IN (:...chargeTypes)`, {
				chargeTypes: params.chargeTypes,
			});
			expect(queryBuilder.queryAndWhere).toHaveBeenNthCalledWith(11, `Space.packageShow IN (:...packageShow)`, {
				packageShow: params.packageShow,
			});
		});

		it('list should return array with all valid parameters', async () => {
			await thisService.list(params);
			const baseListSpy = jest.spyOn(thisService, '_baseList');
			const queryBuilder = repo.createQueryBuilder();

			await thisService._baseList(params,false);

			expect(baseListSpy).toHaveBeenCalled();

			expect(queryBuilder.take).toHaveBeenCalledWith(params.limit);
			expect(queryBuilder.skip).toHaveBeenCalledWith(params.offset);

			expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
		});

		it('listWP should return array with all valid parameters', async () => {
			await thisService.list(params);
			const listWPSpy = jest.spyOn(thisService, 'listWP');
			const queryBuilder = repo.createQueryBuilder();

			await thisService.listWP(params);

			expect(listWPSpy).toHaveBeenCalled();

            expect(queryBuilder.distinctOn).toHaveBeenCalledWith(['Space.id']);
			expect(queryBuilder.select).toHaveBeenCalledWith('Space.id');
            expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(1,`ST_Distance(venue.coordinates, ST_MakePoint(${params.longitude}, ${params.latitude}))`, 'distance');
            expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(2,`ST_Distance(venue.coordinates, ST_MakePoint(${params.longitude}, ${params.latitude}))`, 'distance');
            expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(3,`ST_Distance(venue.coordinates, ST_MakePoint(${params.longitude}, ${params.latitude}))`, 'distance');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(4, 'Space.description');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(5, 'Space.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(6, 'Space.alias');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(7, 'Space.price');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(8, 'Space.quantity');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(9, 'Space.capacity');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(10, 'amenities.amenity.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(11, 'amenities.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(12, 'amenities.description');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(13, 'amenities.price');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(14, 'amenities.salesTax');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(15, 'Space.hideQuantity');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(16, 'Space.notAllowCredit');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(17, 'Space.quantityUnlimited');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(18, 'Space.tax');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(19, 'spaceType.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(20, 'spaceType.alias');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(21, 'spaceTypeParent.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(22, 'spaceTypeParent.alias');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(23, 'photos.url');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(24, 'eventData.accessHoursFrom');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(25, 'eventData.accessHoursTo');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(26, 'eventData.date');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(27, 'venue.id');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(28, 'venue.name');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(29, 'venue.alias');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(30, 'venue.country');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(31, 'venue.state');
			expect(queryBuilder.addSelect).toHaveBeenNthCalledWith(32, 'venue.city');

			expect(queryBuilder.cache).toHaveBeenCalledWith(true);

			expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
		});
	});
});
