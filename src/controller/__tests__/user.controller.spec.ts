import { faker } from '@faker-js/faker';
import {
	TestInt401Method,
	TestInt403Method,
	TestInt422Method,
	TestIntCreateMethod,
	TestIntListMethod,
	TestIntUpdate404Method,
	TestIntUpdateMethod,
} from '@controller/__tests__/base-service.spec';
import { TestBrandSecond, TestRoleMember, TestSpaceMonthlySecond, TestUserBrandAdmin, TestUserBrandMember } from '@utils/tests/base-data';
import UserEntity from '@src/entity/user.entity';
import EmailTemplateTypeEntity from '@entity/email-template-type.entity';
import EmailTemplateEntity from '@entity/email-template.entity';
import UserPrivatePackageEntity from '@entity/user-private-package.entity';
import PackageStatus from 'dd-common-blocks/dist/type/PackageStatus';
import MainDataSource from '@src/main-data-source';
import CreateCCDto from '@src/dto/create-cc.dto';
import EditCcDto from '@src/dto/edit-cc.dto';
import InviteUserToBrandDto from '@src/dto/invite-user-to-brand.dto';
import ImportUsersDto from '@src/dto/import-users.dto';
import ImportUsersValidateDto from '@src/dto/import-users-validate.dto';
import CreateUserDto from '@src/dto/create-user.dto';
import RoleEntity from '@entity/role.entity';
import BrandEntity from '@entity/brand.entity';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';
import UpdateUserDto from '@src/dto/update-user.dto';
import UserStatus from 'dd-common-blocks/dist/type/UserStatus';

const url = '/user';

beforeAll(async () => {
	const newTemplateType = await MainDataSource.getRepository(EmailTemplateTypeEntity).save(
		MainDataSource.getRepository(EmailTemplateTypeEntity).create({ name: 'Welcome to Brand' })
	);
	await MainDataSource.getRepository(EmailTemplateEntity).save(
		MainDataSource.getRepository(EmailTemplateEntity).create({
			name: 'test template',
			brandId: TestBrandSecond.id,
			emailTemplateTypeId: newTemplateType.id,
			fromEmail: 'test@mail.com',
			fromName: 'any name',
			html: '',
			unlayerDesign: {},
		})
	);

	await MainDataSource.getRepository(UserPrivatePackageEntity).save(
		MainDataSource.getRepository(UserPrivatePackageEntity).create({
			userId: TestUserBrandMember.id,
			spaceId: TestSpaceMonthlySecond.id,
			status: PackageStatus.BOOKED,
		})
	);
});

const createUser = async ({ type }: { type: 'member' | 'admin' | 'sa' }) => {
	const newUser = {
		firstname: faker.name.firstName(),
		lastname: faker.name.lastName(),
		email: faker.internet.email(),
		username: faker.internet.userName(),
		phone: Number(faker.random.numeric(8)),
		password: faker.internet.password(),
		about: faker.lorem.paragraphs(3),
		brandId: 1,
		roleId: 1,
	};

	let roleType: BrandRoleType = BrandRoleType.MEMBER;
	if (type === 'sa') roleType = BrandRoleType.SUPERADMIN;
	if (type === 'admin') roleType = BrandRoleType.ADMIN;

	const newBrand = await MainDataSource.getRepository(BrandEntity).save(
		MainDataSource.getRepository(BrandEntity).create({ name: faker.lorem.words(3), domain: faker.internet.domainWord() })
	);
	const newRole = await MainDataSource.getRepository(RoleEntity).save(
		MainDataSource.getRepository(RoleEntity).create({ name: faker.lorem.words(3), brandId: newBrand.id, roleType })
	);
	newUser.brandId = newBrand.id;
	newUser.roleId = newRole.id;

	return MainDataSource.getRepository(UserEntity).save(MainDataSource.getRepository(UserEntity).create(newUser));
};

const deleteUser = async (id: number) => {
	return MainDataSource.getRepository(UserEntity).delete(id);
};

describe(`ROUTE: /user`, () => {
	const newUser: CreateUserDto = {
		firstname: faker.name.firstName(),
		lastname: faker.name.lastName(),
		email: faker.internet.email(),
		username: faker.internet.userName(),
		phone: Number(faker.random.numeric(8)),
		password: faker.internet.password(),
		about: faker.lorem.paragraphs(3),
		brandId: TestUserBrandMember.brandId,
		roleId: TestRoleMember.id,
	};

	describe('Create user', () => {
		let brandMember: UserEntity;

		beforeAll(async () => {
			brandMember = await createUser({ type: 'member' });
		});

		it('POST should throw error as not authorized user', async () => {
			await TestInt401Method({ url, method: 'post', entity: UserEntity });
		});

		it('POST should return 200 and newly created object as brand admin', async () => {
			await TestIntCreateMethod({
				url,
				createObj: { ...newUser, brandId: TestUserBrandAdmin.brandId },
				entity: UserEntity,
				asAdmin: true,
			});
		});

		it('POST should throw error as member', async () => {
			await TestInt403Method({
				url,
				obj: { ...newUser, email: faker.internet.email(), username: faker.internet.userName(), phone: Number(faker.random.numeric(8)) },
				method: 'post',
				entity: UserEntity,
				asMember: true,
			});
		});

		it('POST should return 200 and newly created object as SuperAdmin', async () => {
			await TestIntCreateMethod({
				createObj: { ...newUser, email: faker.internet.email(), username: faker.internet.userName(), phone: Number(faker.random.numeric(8)) },
				url,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('POST should return validation error for object with empty email and phone and return first error (empty field name)', async () => {
			const obj = {
				email: '',
			};

			const expectedErrors = [
				{
					property: 'email',
				},
			];
			await TestInt422Method({ obj, url, method: 'post', entity: UserEntity, asSuperAdmin: true, expectedErrors });
		});

		it('POST should return validation error for object phone that already exist', async () => {
			const expectedErrors = [
				{
					property: 'phone',
				},
			];
			await TestInt422Method({
				obj: { ...newUser, phone: 987654321 },
				url,
				method: 'post',
				entity: UserEntity,
				asSuperAdmin: true,
				expectedErrors,
			});
		});

		it('POST should return validation error for object email that already exist', async () => {
			const expectedErrors = [
				{
					property: 'email',
				},
			];
			await TestInt422Method({
				obj: { ...newUser, email: 'admin@mail.com' },
				url,
				method: 'post',
				entity: UserEntity,
				asSuperAdmin: true,
				expectedErrors,
			});
		});

		it('POST should not allow to create user with email already exist', async () => {
			const expectedErrors = [
				{
					property: 'email',
				},
			];
			await TestInt422Method({
				obj: { ...newUser, email: brandMember.email },
				url,
				method: 'post',
				entity: UserEntity,
				asSuperAdmin: true,
				expectedErrors,
			});
		});

		it('POST should not allow to create user with phone already exist', async () => {
			const expectedErrors = [
				{
					property: 'phone',
				},
			];
			await TestInt422Method({
				obj: { ...newUser, email: brandMember.phone },
				url,
				method: 'post',
				entity: UserEntity,
				asSuperAdmin: true,
				expectedErrors,
			});
		});

		it('POST should not allow to create user with username already exist', async () => {
			const expectedErrors = [
				{
					property: 'username',
				},
			];
			await TestInt422Method({
				obj: { ...newUser, email: brandMember.username },
				url,
				method: 'post',
				entity: UserEntity,
				asSuperAdmin: true,
				expectedErrors,
			});
		});
	});

	it('PUT should throw error for not authorized user', async () => {
		await TestInt401Method({ id: TestUserBrandMember.id, url, method: 'put', entity: UserEntity });
	});

	it('PUT should throw error for not owner', async () => {
		const updateUserData: UpdateUserDto = {
			firstname: faker.name.firstName(),
			lastname: faker.name.lastName(),
			username: faker.internet.userName(),
			email: faker.internet.email(),
			phone: Number(faker.random.numeric(8)),
		};

		await TestInt403Method({
			id: TestUserBrandAdmin.id,
			url,
			method: 'put',
			entity: UserEntity,
			asMember: true,
			obj: updateUserData,
		});
	});

	it('PUT should return 200 and updated object as super admin', async () => {
		const updateUserData: UpdateUserDto = {
			firstname: faker.name.firstName(),
			lastname: faker.name.lastName(),
			username: faker.internet.userName(),
			email: faker.internet.email(),
			phone: Number(faker.random.numeric(8)),
		};

		await TestIntUpdateMethod({ updateObj: updateUserData, id: TestUserBrandMember.id, url, entity: UserEntity, asSuperAdmin: true });
	});

	it('PUT should return 200 and updated object as brand admin', async () => {
		const updateUserData: UpdateUserDto = {
			firstname: faker.name.firstName(),
			lastname: faker.name.lastName(),
			username: faker.internet.userName(),
			email: faker.internet.email(),
			phone: Number(faker.random.numeric(8)),
		};

		await TestIntUpdateMethod({ updateObj: updateUserData, id: TestUserBrandMember.id, url, entity: UserEntity, asAdmin: true });
	});

	it('PUT should return 200 and updated object as owner', async () => {
		const updateUserData: UpdateUserDto = {
			firstname: faker.name.firstName(),
			lastname: faker.name.lastName(),
			username: faker.internet.userName(),
			email: faker.internet.email(),
			phone: Number(faker.random.numeric(8)),
		};

		await TestIntUpdateMethod({ updateObj: updateUserData, id: TestUserBrandMember.id, url, entity: UserEntity, asMember: true });
	});

	describe('Should update USER profile fields', () => {
		let newUpdateUserProfileBrand: BrandEntity;
		let newUpdateUserProfileRole: RoleEntity;

		let brandMember: UserEntity;

		beforeAll(async () => {
			newUpdateUserProfileBrand = await MainDataSource.getRepository(BrandEntity).save(
				MainDataSource.getRepository(BrandEntity).create({ name: faker.lorem.words(3), domain: faker.internet.domainWord() })
			);
			newUpdateUserProfileRole = await MainDataSource.getRepository(RoleEntity).save(
				MainDataSource.getRepository(RoleEntity).create({
					name: faker.lorem.words(3),
					brandId: newUpdateUserProfileBrand.id,
					roleType: BrandRoleType.ADMIN,
				})
			);

			brandMember = await createUser({ type: 'member' });
		});

		it('should update only "firstname"', async () => {
			const updateUserData: UpdateUserDto = {
				firstname: faker.name.firstName(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "status"', async () => {
			const updateUserData: UpdateUserDto = {
				status: UserStatus.ACTIVE,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "lastname"', async () => {
			const updateUserData = {
				lastname: faker.name.lastName(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asAdmin: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "email"', async () => {
			const updateUserData: UpdateUserDto = {
				email: faker.internet.email(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "phone"', async () => {
			const updateUserData: UpdateUserDto = {
				phone: Number(faker.random.numeric(7)),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "username"', async () => {
			const updateUserData: UpdateUserDto = {
				username: faker.internet.userName(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "brand"', async () => {
			const updateUserData: UpdateUserDto = {
				brandId: newUpdateUserProfileBrand.id,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "role"', async () => {
			const updateUserData: UpdateUserDto = {
				roleId: newUpdateUserProfileRole.id,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				id: brandMember.id,
				url,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		afterAll(async () => {
			await deleteUser(brandMember.id);
		});
	});

	describe('Should update MEMBER profile fields as admin', () => {
		let newUpdateUserProfileBrand: BrandEntity;
		let newUpdateUserProfileRole: RoleEntity;

		let brandMember: UserEntity;

		beforeAll(async () => {
			newUpdateUserProfileBrand = await MainDataSource.getRepository(BrandEntity).save(
				MainDataSource.getRepository(BrandEntity).create({ name: faker.lorem.words(3), domain: faker.internet.domainWord() })
			);
			newUpdateUserProfileRole = await MainDataSource.getRepository(RoleEntity).save(
				MainDataSource.getRepository(RoleEntity).create({
					name: faker.lorem.words(3),
					brandId: newUpdateUserProfileBrand.id,
					roleType: BrandRoleType.ADMIN,
				})
			);

			brandMember = await createUser({ type: 'member' });
		});

		it('should update only "status"', async () => {
			const updateUserData: UpdateUserDto = {
				status: UserStatus.ACTIVE,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${brandMember.id}/update-member`,
				entity: UserEntity,
				asMember: true,
				requestUserId: brandMember.id,
			});
		});

		it('should update only "firstname"', async () => {
			const updateUserData: UpdateUserDto = {
				firstname: faker.name.firstName(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${brandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "lastname"', async () => {
			const updateUserData = {
				lastname: faker.name.lastName(),
			};

			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${brandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "email"', async () => {
			const updateUserData: UpdateUserDto = {
				email: faker.internet.email(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${TestUserBrandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "phone"', async () => {
			const updateUserData: UpdateUserDto = {
				phone: Number(faker.random.numeric(8)),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${TestUserBrandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "username"', async () => {
			const updateUserData: UpdateUserDto = {
				username: faker.internet.userName(),
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${TestUserBrandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "brand"', async () => {
			const updateUserData: UpdateUserDto = {
				brandId: newUpdateUserProfileBrand.id,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${brandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		it('should update only "role"', async () => {
			const updateUserData: UpdateUserDto = {
				roleId: newUpdateUserProfileRole.id,
			};
			await TestIntUpdateMethod({
				updateObj: updateUserData,
				url: `${url}/${brandMember.id}/update-member`,
				entity: UserEntity,
				asSuperAdmin: true,
			});
		});

		afterAll(async () => {
			await deleteUser(brandMember.id);
		});
	});

	it('GET should throw error for not logged in users', async () => {
		await TestInt401Method({ id: TestUserBrandMember.id, url, entity: UserEntity });
	});

	it('GET PRIVATE PACKAGES should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/private-packages`, entity: UserPrivatePackageEntity });
	});

	it('GET PRIVATE PACKAGES should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/private-packages`, entity: UserPrivatePackageEntity, asSuperAdmin: true });
	});

	it('GET SPACE CREDITS should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/space-credits`, entity: UserEntity });
	});

	it('GET SPACE CREDITS  should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/space-credits`, entity: UserEntity, asSuperAdmin: true });
	});

	it('GET CHECK-INS should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/check-ins`, entity: UserEntity });
	});

	it('GET CHECK-INS should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/check-ins`, entity: UserEntity, asSuperAdmin: true });
	});

	it('GET CARDS should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/cards`, entity: UserEntity });
	});

	it('GET CARDS should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/cards`, entity: UserEntity, asSuperAdmin: true });
	});

	it('GET COMPANY should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/company`, entity: UserEntity });
	});

	it('GET COMPANY should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/company`, entity: UserEntity, asSuperAdmin: true });
	});

	it('GET DEPOSIT should throw error for not logged in users', async () => {
		await TestInt401Method({ url: `${url}/${TestUserBrandMember.id}/deposit`, entity: UserEntity });
	});

	it('GET DEPOSIT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999/deposit`, entity: UserEntity, asSuperAdmin: true });
	});

	it('GET LIST should throw error for not logged in users', async () => {
		await TestInt401Method({ url, entity: UserEntity });
	});

	it('POST CARDS should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/${TestUserBrandMember.id}/cards`, entity: UserEntity });
	});

	it('POST CARDS should throw error as member', async () => {
		const obj: CreateCCDto = {
			number: '4242424242424242',
			exp_month: '10',
			exp_year: '30',
		};
		await TestInt403Method({ url: `${url}/${TestUserBrandAdmin.id}/cards`, method: 'post', entity: UserEntity, asMember: true, obj });
	});

	it('POST SET DEFAULT CARD should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/${TestUserBrandMember.id}/cards/12313/set-default`, entity: UserEntity });
	});

	it('POST SET DEFAULT CARD should throw error as member', async () => {
		await TestInt403Method({
			url: `${url}/${TestUserBrandAdmin.id}/cards/12313/set-default`,
			method: 'post',
			entity: UserEntity,
			asMember: true,
		});
	});

	it('POST SET DEFAULT CARD should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'post', url: `${url}/99999/cards/12313/set-default`, entity: UserEntity, asSuperAdmin: true });
	});

	it('POST MOVE OUT should throw error as member', async () => {
		await TestInt403Method({ url: `${url}/${TestUserBrandMember.id}/move-out`, method: 'post', entity: UserEntity, asMember: true });
	});

	it('POST MOVE OUT should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/${TestUserBrandMember.id}/move-out`, entity: UserEntity });
	});

	it('POST MOVE OUT should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'post', url: `${url}/99999/move-out`, entity: UserEntity, asSuperAdmin: true });
	});

	it('POST ACTIVATE should throw error as member', async () => {
		await TestInt403Method({ url: `${url}/${TestUserBrandMember.id}/activate`, method: 'post', entity: UserEntity, asMember: true });
	});

	it('POST ACTIVATE should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/${TestUserBrandMember.id}/activate`, entity: UserEntity });
	});

	it('POST ACTIVATE should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'post', url: `${url}/99999/activate`, entity: UserEntity, asSuperAdmin: true });
	});

	it('POST INVITE should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/invite`, entity: UserEntity });
	});

	it('POST INVITE should throw error as member', async () => {
		const obj: InviteUserToBrandDto = { brandId: '99', teamId: '99', emails: ['qwer@asd.com'] };
		await TestInt403Method({ url: `${url}/invite`, method: 'post', entity: UserEntity, asMember: true, obj });
	});

	it('POST IMPORT should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/import`, entity: UserEntity });
	});

	it('POST IMPORT should throw error as member', async () => {
		const obj: ImportUsersDto = { users: [] };
		await TestInt403Method({ url: `${url}/import`, method: 'post', entity: UserEntity, asMember: true, obj });
	});

	it('POST VALIDATE IMPORT should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'post', url: `${url}/validate-import`, entity: UserEntity });
	});

	it('POST VALIDATE-IMPORT should throw error as member', async () => {
		const obj: ImportUsersValidateDto = { username: 'qwert', phone: 45678, email: 'asdfg@qwe.com' };
		await TestInt403Method({ url: `${url}/validate-import`, method: 'post', entity: UserEntity, asMember: true, obj });
	});

	it('PUT CARDS should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'put', url: `${url}/${TestUserBrandMember.id}/cards/123123`, entity: UserEntity });
	});

	it('PUT CARDS should throw error as member', async () => {
		const obj: EditCcDto = {
			exp_month: '99',
			exp_year: '99',
		};
		await TestInt403Method({ url: `${url}/${TestUserBrandAdmin.id}/cards/123123`, method: 'put', entity: UserEntity, asMember: true, obj });
	});

	it('PUT CARDS should return 404 for object that not exist', async () => {
		const obj: EditCcDto = {
			exp_month: '99',
			exp_year: '99',
		};
		await TestIntUpdate404Method({ method: 'put', url: `${url}/99999/cards/123123`, entity: UserEntity, asSuperAdmin: true, obj });
	});

	it('DELETE CARDS should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'delete', url: `${url}/${TestUserBrandMember.id}/cards/123123`, entity: UserEntity });
	});

	it('DELETE CARDS should throw error as member', async () => {
		await TestInt403Method({ url: `${url}/${TestUserBrandAdmin.id}/cards/123123`, method: 'delete', entity: UserEntity, asMember: true });
	});

	it('DELETE CARDS should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'delete', url: `${url}/99999/cards/123123`, entity: UserEntity, asSuperAdmin: true });
	});

	it('DELETE should throw error for not logged in users', async () => {
		await TestInt401Method({ method: 'delete', url: `${url}/${TestUserBrandMember.id}`, entity: UserEntity });
	});

	it('GET should return 404 for object that not exist', async () => {
		await TestIntUpdate404Method({ method: 'get', url: `${url}/99999`, entity: UserEntity, asSuperAdmin: true });
	});

	// TODO
	// get as member
	it('GET PRIVATE PACKAGES should return 200 & valid response and array', async () => {
		await TestIntListMethod({ url: `${url}/${TestUserBrandMember.id}/private-packages`, entity: UserPrivatePackageEntity, asMember: true });
	});
});
