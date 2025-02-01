import { faker } from '@faker-js/faker';
import UserService from '@services/user.service';
import UserStatus from 'dd-common-blocks/dist/type/UserStatus';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import UserEntity from '@src/entity/user.entity';
import SubscriptionEntity from '@src/entity/subscription.entity';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import MainDataSource from '@src/main-data-source';
import { TestRoleAdmin } from '@utils/tests/base-data';
import { CreateQueryBuilderMock, TestUnitUserSuperAdmin } from '@utils/tests/typeorm.mock';
import { Repository } from 'typeorm/repository/Repository';
import UpdateUserDto from '@src/dto/update-user.dto';
import TeamMemberEntity from '@entity/team-member.entity';
import { In, Not } from 'typeorm';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';

jest.mock('@services/invoice.service');
jest.mock('@utils/helpers/send-mail.helper');

let thisService: UserService;

const subItem: SubscriptionEntity = {
	id: Number(faker.random.numeric(2)),
	name: faker.random.word(),
	startDate: new Date(),
	endDate: new Date(),
	securityAmount: Number(faker.random.numeric(2)),
	spaceAmount: Number(faker.random.numeric(2)),
	userId: Number(faker.random.numeric(2)),
	brandId: Number(faker.random.numeric(2)),
	spaceId: Number(faker.random.numeric(2)),
	venueId: Number(faker.random.numeric(2)),
	createdById: Number(faker.random.numeric(2)),
	isOngoing: true,
	takePayment: true,
	access247: true,
	status: SubscriptionStatus.ACTIVE,
	createdAt: new Date(),
	updatedAt: new Date(),
	chargeType: ChargeType.MONTHLY,
	billCycleDate: Number(faker.random.numeric(2)),
	providerData: [
		// @ts-ignore
		{
			id: Number(faker.random.numeric(2)),
			provider: PaymentProvider.STRIPE,
			subscriptionId: Number(faker.random.numeric(2)),
			providerSubscriptionId: faker.random.word(),
		},
	],
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
};

const item: UserEntity = {
	id: Number(faker.random.numeric(2)),
	firstname: faker.name.firstName(),
	lastname: faker.name.lastName(),
	username: faker.internet.userName(),
	subscriptions: [subItem],
	isAdmin: false,
	securityDepositToRevenue: Number(faker.random.numeric(2)),
	email: faker.internet.email(),
	emailVerified: true,
	stripeCustomerId: '',
	securityDeposit: Number(faker.random.numeric(2)),
	about: '',
	phone: 0,
	brandId: Number(faker.random.numeric(2)),
	roleId: Number(faker.random.numeric(2)),
	status: UserStatus.ACTIVE,
	createdAt: new Date(),
	updatedAt: new Date(),
	role: TestRoleAdmin,
	_canDelete(user: UserEntity | undefined): boolean {
		return true;
	},
	_canEdit(user: UserEntity | undefined): boolean {
		return true;
	},
	isSuperAdmin(): boolean | any {
		return false;
	},
};

describe('SERVICE: User Service', () => {
	let repo: Repository<UserEntity>;

	beforeAll(() => {
		thisService = new UserService();
	});

	beforeEach(() => {
		repo = MainDataSource.getRepository(UserEntity);
		repo.createQueryBuilder = CreateQueryBuilderMock(item);
	});

	it('helper: _canViewOrEdit user view his profile', async () => {
		const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail').mockResolvedValue(item);

		const result = await thisService._canViewOrEdit(item.id, item);

		expect(findOneOrFailSpy).toBeCalled();
		expect(findOneOrFailSpy).toBeCalledWith({ where: { id: item.id } });

		expect(result).toBe(true);
	});

	it('helper: _canViewOrEdit brand admin view profile', async () => {
		const userId = Number(faker.random.numeric(2));
		const findOneOrFailSpy = jest
			.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail')
			.mockResolvedValue({ ...item, id: userId, isAdmin: true });

		const result = await thisService._canViewOrEdit(userId, item);

		expect(findOneOrFailSpy).toBeCalled();
		expect(findOneOrFailSpy).toBeCalledWith({ where: { id: userId } });

		expect(result).toBe(true);
	});

	it('helper: _canViewOrEdit cant view not same brand user', async () => {
		const userId = Number(faker.random.numeric(2));
		const brandId = Number(faker.random.numeric(2));

		const findOneOrFailSpy = jest
			.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail')
			.mockResolvedValue({ ...item, brandId, id: userId, isAdmin: false });

		try {
			await thisService._canViewOrEdit(userId, item);

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: userId } });
		} catch (e) {
			expect((e as Error).message).toBe('no access');
		}
	});

	it('helper: _canViewOrEdit super admin view profile', async () => {
		const userId = Number(faker.random.numeric(2));

		const findOneOrFailSpy = jest
			.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail')
			.mockResolvedValue({ ...item, username: 'Superadmin', id: userId, isAdmin: true });

		const result = await thisService._canViewOrEdit(userId, item);

		expect(findOneOrFailSpy).toBeCalled();
		expect(findOneOrFailSpy).toBeCalledWith({ where: { id: userId } });

		expect(result).toBe(true);
	});

	it('helper: _canViewOrEdit return error if other member request user profile', async () => {
		const userId = Number(faker.random.numeric(2));

		const findOneOrFailSpy = jest
			.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail')
			.mockResolvedValue({ ...item, id: userId, isAdmin: false });

		try {
			await thisService._canViewOrEdit(userId, item);
			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: userId } });
		} catch (e) {
			expect((e as Error).message).toBe('no access');
		}
	});

	// todo queryBuilder
	// it('helper: _emailValidator', async () => {
	// 	try {
	// 		const result = await thisService._emailValidator(user.email);
	// 		expect(result).toEqual(true);
	//
	// 		const queryBuilder = typeorm.getConnection().getRepository(UserEntity).createQueryBuilder;
	// 		expect(queryBuilder).toHaveBeenNthCalledWith(1, 'User');
	//
	// 		expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(1, `email = :value`, { value: user.email });
	// 		expect(queryBuilder().getOne).toHaveBeenNthCalledWith(1);
	// 	} catch (e) {
	// 		expect((e as Error).message).toBe(`Email ${user.email} is already taken`);
	// 	}
	// });
	//
	// it('helper: _validateImport', async () => {
	// 	const result = await thisService._validateImport({ phone: user.phone, email: user.email, username: user.username });
	// 	expect(result).toEqual({ isValidPhone: false, isValidEmail: false, isValidUsername: false });
	//
	// 	const queryBuilder = typeorm.getConnection().getRepository(UserEntity).createQueryBuilder;
	// 	expect(queryBuilder).toHaveBeenNthCalledWith(1, 'User');
	//
	// 	expect(queryBuilder().orWhere).toHaveBeenNthCalledWith(1, `phone = :phone`, { phone: user.phone });
	// 	expect(queryBuilder().orWhere).toHaveBeenNthCalledWith(2, `username = :username`, { username: user.username });
	// 	expect(queryBuilder().orWhere).toHaveBeenNthCalledWith(3, `email = :email`, { email: user.email });
	// 	expect(queryBuilder().getOne).toHaveBeenNthCalledWith(1);
	// });

	describe('helper: _getSubscriptionsByUserId', () => {
		it('should pass with user id and default subscription relations', async () => {
			const userId = Number(faker.random.numeric(2));
			const teamMemberItem = {
				id: Number(faker.random.numeric(2)),
				team: {
					id: Number(faker.random.numeric(2)),
					subscriptions: [
						{
							id: Number(faker.random.numeric(2)),
						},
					],
				},
			};

			const subscriptionItem = {
				name: faker.random.words(2),
				startDate: faker.date.recent(2),
				endDate: faker.date.soon(2),
				securityAmount: 0,
				spaceAmount: 200,
				userId,
				brandId: Number(faker.random.numeric(2)),
				spaceId: Number(faker.random.numeric(2)),
				venueId: Number(faker.random.numeric(2)),
				createdById: Number(faker.random.numeric(2)),
				updatedById: Number(faker.random.numeric(2)),
				status: SubscriptionStatus.ACTIVE,
				isOngoing: true,
				takePayment: true,
				access247: true,
				chargeType: ChargeType.CHARGE_NOW,
				billCycleDate: faker.random.numeric(2),
			};

			const findUserSubIdsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([{ id: Number(faker.random.numeric(2)) }]);

			const findUserTeamsIdsSpy = jest.spyOn(MainDataSource.getRepository(TeamMemberEntity) as any, 'find').mockResolvedValue([teamMemberItem]);

			const findSubscriptionsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([subscriptionItem]);

			const result = await UserService._getSubscriptionsByUserId(userId);

			expect(findUserSubIdsSpy).toBeCalled();
			expect(findUserSubIdsSpy).toBeCalledWith({
				where: [
					{
						userId: userId,
						isOngoing: true,
					},
				],
				select: ['id'],
			});

			expect(findUserTeamsIdsSpy).toBeCalled();
			expect(findUserTeamsIdsSpy).toBeCalledWith({
				select: {
					id: true,
					team: {
						id: true,
						subscriptions: {
							id: true,
						},
					},
				},
				relations: ['team', 'team.subscriptions'],
				where: {
					memberId: userId,
					status: Not(TeamMemberStatus.MEMBER_REMOVED),
					team: {
						subscriptions: {
							isOngoing: true,
						},
					},
				},
			});

			expect(findSubscriptionsSpy).toBeCalled();
			expect(findSubscriptionsSpy).toBeCalledWith({
				where: {
					id: In([teamMemberItem.team.subscriptions[0].id]),
				},
				relations: ['brand', 'brands', 'spaceTypes', 'creditHours', 'creditsRotation', 'venue', 'space', 'venues', 'teams', 'venueTypes'],
			});

			expect(result).toEqual([subscriptionItem]);
		});

		it('should pass with user id and custom subscription relations', async () => {
			const userId = Number(faker.random.numeric(2));
			const teamMemberItem = {
				id: Number(faker.random.numeric(2)),
				team: {
					id: Number(faker.random.numeric(2)),
					subscriptions: [
						{
							id: Number(faker.random.numeric(2)),
						},
					],
				},
			};

			const subscriptionItem = {
				name: faker.random.words(2),
				startDate: faker.date.recent(2),
				endDate: faker.date.soon(2),
				securityAmount: 0,
				spaceAmount: 200,
				userId,
				brandId: Number(faker.random.numeric(2)),
				spaceId: Number(faker.random.numeric(2)),
				venueId: Number(faker.random.numeric(2)),
				createdById: Number(faker.random.numeric(2)),
				updatedById: Number(faker.random.numeric(2)),
				status: SubscriptionStatus.ACTIVE,
				isOngoing: true,
				takePayment: true,
				access247: true,
				chargeType: ChargeType.CHARGE_NOW,
				billCycleDate: faker.random.numeric(2),
			};

			const findUserSubIdsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([{ id: Number(faker.random.numeric(2)) }]);

			const findUserTeamsIdsSpy = jest.spyOn(MainDataSource.getRepository(TeamMemberEntity) as any, 'find').mockResolvedValue([teamMemberItem]);

			const findSubscriptionsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([subscriptionItem]);

			const result = await UserService._getSubscriptionsByUserId(userId, ['venue', 'space']);

			expect(findUserSubIdsSpy).toBeCalled();
			expect(findUserSubIdsSpy).toBeCalledWith({
				where: [
					{
						userId: userId,
						isOngoing: true,
					},
				],
				select: ['id'],
			});

			expect(findUserTeamsIdsSpy).toBeCalled();
			expect(findUserTeamsIdsSpy).toBeCalledWith({
				select: {
					id: true,
					team: {
						id: true,
						subscriptions: {
							id: true,
						},
					},
				},
				relations: ['team', 'team.subscriptions'],
				where: {
					memberId: userId,
					status: Not(TeamMemberStatus.MEMBER_REMOVED),
					team: {
						subscriptions: {
							isOngoing: true,
						},
					},
				},
			});

			expect(findSubscriptionsSpy).toBeCalled();
			expect(findSubscriptionsSpy).toBeCalledWith({
				where: {
					id: In([teamMemberItem.team.subscriptions[0].id]),
				},
				relations: ['venue', 'space'],
			});

			expect(result).toEqual([subscriptionItem]);
		});

		it('should pass with user id and canceled relations', async () => {
			const userId = Number(faker.random.numeric(2));
			const teamMemberItem = {
				id: Number(faker.random.numeric(2)),
				team: {
					id: Number(faker.random.numeric(2)),
					subscriptions: [
						{
							id: Number(faker.random.numeric(2)),
						},
					],
				},
			};

			const subscriptionItem = {
				name: faker.random.words(2),
				startDate: faker.date.recent(2),
				endDate: faker.date.soon(2),
				securityAmount: 0,
				spaceAmount: 200,
				userId,
				brandId: Number(faker.random.numeric(2)),
				spaceId: Number(faker.random.numeric(2)),
				venueId: Number(faker.random.numeric(2)),
				createdById: Number(faker.random.numeric(2)),
				updatedById: Number(faker.random.numeric(2)),
				status: SubscriptionStatus.ACTIVE,
				isOngoing: true,
				takePayment: true,
				access247: true,
				chargeType: ChargeType.CHARGE_NOW,
				billCycleDate: faker.random.numeric(2),
			};

			const findUserSubIdsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([{ id: Number(faker.random.numeric(2)) }]);

			const findUserTeamsIdsSpy = jest.spyOn(MainDataSource.getRepository(TeamMemberEntity) as any, 'find').mockResolvedValue([teamMemberItem]);

			const findSubscriptionsSpy = jest
				.spyOn(MainDataSource.getRepository(SubscriptionEntity) as any, 'find')
				.mockResolvedValue([subscriptionItem]);

			const result = await UserService._getSubscriptionsByUserId(userId, ['venue', 'space'], true);

			expect(findUserSubIdsSpy).toBeCalled();
			expect(findUserSubIdsSpy).toBeCalledWith({
				where: [
					{
						userId,
						isOngoing: true,
					},
					{
						userId,
						status: SubscriptionStatus.CANCELED,
					},
					{
						userId,
						status: SubscriptionStatus.DELETED,
					},
					{
						userId,
						status: SubscriptionStatus.INACTIVE,
					},
				],
				select: ['id'],
			});

			expect(findUserTeamsIdsSpy).toBeCalled();
			expect(findUserTeamsIdsSpy).toBeCalledWith({
				select: {
					id: true,
					team: {
						id: true,
						subscriptions: {
							id: true,
						},
					},
				},
				relations: ['team', 'team.subscriptions'],
				where: {
					memberId: userId,
					status: Not(TeamMemberStatus.MEMBER_REMOVED),
					team: {
						subscriptions: {
							isOngoing: true,
						},
					},
				},
			});

			expect(findSubscriptionsSpy).toBeCalled();
			expect(findSubscriptionsSpy).toBeCalledWith({
				where: {
					id: In([teamMemberItem.team.subscriptions[0].id]),
				},
				relations: ['venue', 'space'],
			});

			expect(result).toEqual([subscriptionItem]);
		});

		it('should return empty array without user ID', async () => {
			const userId = undefined;

			const result = await UserService._getSubscriptionsByUserId(userId);

			expect(result).toEqual([]);
		});
	});

	it('checkExist', async () => {
		const params = { email: item.email, username: item.username };

		const countSpy = jest.spyOn(MainDataSource.getRepository(UserEntity) as any, 'count').mockResolvedValue(0);

		const result = await thisService.checkExist(params);

		expect(countSpy).toBeCalled();
		expect(countSpy).toBeCalledWith({ where: params });

		expect(result).toEqual(0);
	});

	describe('method "update"', () => {
		it('update user profile', async () => {
			const findOneOrFailSpy = jest.spyOn(repo, 'findOneOrFail').mockImplementation(async () => {
				return Promise.resolve(item);
			});

			const canEditSpy = jest.spyOn(item, '_canEdit').mockReturnValue(true);

			const saveSpy = jest.spyOn(repo as any, 'save').mockResolvedValue(Promise.resolve(item));

			const updateData: UpdateUserDto = {
				firstname: faker.name.firstName(),
			};
			const result = await thisService.update(item.id, updateData, TestUnitUserSuperAdmin);

			expect(findOneOrFailSpy).toBeCalled();
			expect(findOneOrFailSpy).toBeCalledWith({ where: { id: item.id } });

			expect(canEditSpy).toBeCalled();
			expect(canEditSpy).toBeCalledWith(TestUnitUserSuperAdmin);

			expect(saveSpy).toBeCalled();
			expect(saveSpy).toBeCalledWith({ ...updateData, id: item.id });

			expect(result).toEqual(item);
		});
	});

	// todo queryBuilder
	// it('getByUsername', async () => {
	// 	const result = await thisService.getByUsername(user.username);
	// 	expect(result).toEqual(user);
	//
	// 	const queryBuilder = typeorm.getConnection().getRepository(UserEntity).createQueryBuilder;
	// 	expect(queryBuilder).toHaveBeenNthCalledWith(1, 'User');
	// 	expect(queryBuilder().addSelect).toHaveBeenNthCalledWith(1, 'User.password');
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(1, `User.username= :username`, { username: user.username });
	// 	expect(queryBuilder().getOne).toHaveBeenCalled();
	// });
	//
	// it('getByEmail', async () => {
	// 	const result = await thisService.getByEmail(user.email);
	// 	expect(result).toEqual(user);
	//
	// 	const queryBuilder = typeorm.getConnection().getRepository(UserEntity).createQueryBuilder;
	// 	expect(queryBuilder).toHaveBeenNthCalledWith(1, 'User');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'User.photo', 'photo');
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(1, `User.email= :email`, { email: user.email });
	// 	expect(queryBuilder().getOne).toHaveBeenCalled();
	// });

	it('getByPhone', async () => {
		const findOneOrFailSpy = jest.spyOn(MainDataSource.getRepository(UserEntity) as any, 'findOneOrFail').mockResolvedValue(item);

		const result = await thisService.getByPhone(item.phone);

		expect(findOneOrFailSpy).toBeCalled();
		expect(findOneOrFailSpy).toBeCalledWith({ where: { phone: item.phone } });

		expect(result).toEqual(item);
	});
	//
	// it('single', async () => {
	// 	const result = await thisService.single(user.id, user);
	// 	expect(result).toEqual(user);
	//
	// 	const queryBuilder = typeorm.getConnection().getRepository(UserEntity).createQueryBuilder;
	// 	expect(queryBuilder).toHaveBeenNthCalledWith(1, 'User');
	//
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'User.role', 'role');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'role.permissions', 'permissions');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(3, 'User.photo', 'photo');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(4, 'User.adminVenues', 'adminVenues');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(5, 'User.brand', 'brand');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(6, 'User.teamMembership', 'teamMembership');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(7, 'teamMembership.team', 'teamMembershipTeam');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(8, 'User.leadingTeams', 'leadingTeams');
	// 	expect(queryBuilder().leftJoinAndSelect).toHaveBeenNthCalledWith(9, 'brand.logo', 'logo');
	// 	expect(queryBuilder().where).toHaveBeenNthCalledWith(1, `User.id = :profileId`, { profileId: user.id });
	// 	expect(queryBuilder().getOne).toHaveBeenNthCalledWith(1);
	//
	// 	// expect(thisService._canViewOrEdit).toBeCalled();
	// 	// expect(UserService._getSubscriptionsByUserId).toBeCalled();
	// 	// expect(thisService.getCards).toBeCalled();
	//
	// });
	//
	// it('getDeposit', async () => {
	// 	const result = await thisService.getDeposit(user.id);
	// 	expect(result).toEqual({ deposit: 0 });
	//
	// 	const queryBuilder = typeorm.getConnection().getRepository(InvoiceItemEntity).createQueryBuilder;
	// 	expect(queryBuilder).toHaveBeenNthCalledWith(1, 'InvoiceItem');
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(1, `InvoiceItem.invoice.userId = :userId`, { userId: user.id });
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(2, 'InvoiceItem.paid=:paid', { paid: true });
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(3, 'InvoiceItem.refunded=:refunded', { refunded: false });
	// 	expect(queryBuilder().andWhere).toHaveBeenNthCalledWith(4, 'InvoiceItem.invoiceItemType.name=:itemType', { itemType: 'security_deposit' });
	// 	expect(queryBuilder().select).toHaveBeenNthCalledWith(1, ['price', 'amountRefunded']);
	// 	expect(queryBuilder().getMany).toHaveBeenNthCalledWith(1);
	// });
});
