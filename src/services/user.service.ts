import Stripe from 'stripe';
import { Brackets, In, Not } from 'typeorm';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import UserEntity from '@entity/user.entity';
import CompanyEntity from '@entity/company.entity';
import CompanyMemberEntity from '@entity/company-member.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import SubscriptionEntity from '@entity/subscription.entity';
import EntityStatus from 'dd-common-blocks/dist/type/EntityStatus';
import UserStatus from 'dd-common-blocks/dist/type/UserStatus';
import loggerHelper from '@helpers/logger.helper';
import { sendAccountNotificationsToUser, sendPredefinedTemplate, sendUserDefinedTemplate } from '@helpers/send-mail.helper';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import { useStripe } from '@helpers/stripe.helper';
import UserPrivatePackageEntity from '@entity/user-private-package.entity';
import BrandEntity from '@entity/brand.entity';
import { AWS_URL, DEFAULT_BRAND_NAME, DEFAULT_ROLE_NAME, DOMAIN, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } from '@src/config';
import BrandRoleType from 'dd-common-blocks/dist/type/BrandRoleType';
import RoleEntity from '@entity/role.entity';
import InvoiceEntity from '@entity/invoice.entity';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import RefundEntity from '@entity/refund.entity';
import SubscriptionService from '@services/subscription.service';
import ValidateEmailHelper from '@helpers/validate-email.helper';
import ReservationEntity from '@entity/reservation.entity';
import CompanyService from '@services/company.service';
import TeamService from '@services/team.service';
import TeamEntity from '@entity/team.entity';
import SpaceEntity from '@entity/space.entity';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import HoursType from 'dd-common-blocks/dist/type/HoursType';
import SubscriptionCreditHoursEntity from '@entity/subscription-credit-hours.entity';
import CreditRotationType from 'dd-common-blocks/dist/type/CreditRotationType';
import UserFilterInterface from 'dd-common-blocks/dist/interface/filter/user-filter.interface';
import TeamMemberStatus from 'dd-common-blocks/dist/type/TeamMemberStatus';
import TeamMemberEntity from '@entity/team-member.entity';
import { ErrorResponse } from '@utils/response/error.response';
import FileEntity from '@entity/file.entity';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import BaseService from '@services/base.service';
import SubscriptionStatus from 'dd-common-blocks/dist/type/SubscriptionStatus';
import { Inject, Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import Socket from '@src/socket';
import SocketEventsType from 'dd-common-blocks/dist/type/SocketEventsType';
import TokenEntity from '@entity/token.entity';
import StripeService from '@services/stripe.service';
import UpdateUserDto from '@src/dto/update-user.dto';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import CreateUserDto from '@src/dto/create-user.dto';
import UserSpaceHoursResponse from '@src/dto/response/user-space-hours.resp';
import UserDepositResponse from '@src/dto/response/user-deposit.resp';
import ImportUsersValidateResp from '@src/dto/response/import-users-validate.resp';
import ImportUsersValidateDto from '@src/dto/import-users-validate.dto';
import StripeCardResp from '@src/dto/response/stripe-card.resp';
import winstonLogger from '@src/utils/helpers/winston-logger';
import { getSecretValue } from '@src/utils/helpers/secretManager';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

dayjs.extend(customParseFormat);

interface CustomerCard extends Stripe.Card {
	isDefault: boolean;
}

export interface ValidateImportInterface {
	isValidPhone: boolean | null;
	isValidEmail: boolean | null;
	isValidUsername: boolean | null;
}

type SubscriptionRelation =
	| 'brand'
	| 'brands'
	| 'spaceTypes'
	| 'creditHours'
	| 'creditsRotation'
	| 'venue'
	| 'space'
	| 'space.packageVenueTypes'
	| 'space.packageSubCategories'
	| 'venues'
	| 'teams'
	| 'venueTypes'
	|'subCategories';

	const dynamoClient = new DynamoDBClient({
		region: "us-east-1",
		credentials: {
		  accessKeyId: S3_ACCESS_KEY_ID,
		  secretAccessKey: S3_SECRET_ACCESS_KEY
		}
	  });

	const documentClient = DynamoDBDocumentClient.from(dynamoClient);
/**
 * Handle all actions with users.
 * @module UserService
 * @category Services
 */
@Service()
export default class UserService extends BaseService {
	@Inject()
	stripeService: StripeService;

	constructor() {
		super();
		this.entity = UserEntity;
	}

	checkUserStatus(user: UserEntity) {
		if ([UserStatus.SUSPENDED, UserStatus.MOVEOUT, UserStatus.DELETED].includes(user.status)) {
			let statusName: string = user.status;
			if (user.status === UserStatus.MOVEOUT) statusName = 'moved out';
			if (user.status === UserStatus.SUSPENDED) statusName = 'suspended';
			if (user.status === UserStatus.DELETED) statusName = 'deleted';

			throw new ErrorResponse({
				code: 401,
				message: `Your account has been ${statusName}, please contact your brand admin`,
			});
		}
		return true;
	}

	async _canViewOrEdit(userId: string | number, entity: UserEntity): Promise<boolean> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: Number(userId) } });

		if (
			user.isSuperAdmin() ||
			(user.isAdmin && user.brandId === entity.brandId) ||
			Number(user.id) === Number(entity.id) ||
			user.brandId === entity.brandId
		) {
			return true;
		}

		throw new ForbiddenResponse({ message: 'no access' });
	}

	/**
	 * Get user subscriptions by ID
	 * @param userId
	 * @param withCanceled
	 * @param relations - 'brand',
	 *      'brands',
	 *      'spaceTypes',
	 *      'creditHours',
	 *      'creditsRotation',
	 *      'venue',
	 *      'space',
	 *      'venues',
	 *      'teams',
	 *      'venueTypes'
	 */
	static async _getSubscriptionsByUserId(
		userId: string | number | undefined,
		relations: SubscriptionRelation[] | undefined = [
			'brand',
			'brands',
			'spaceTypes',
			'creditHours',
			'creditsRotation',
			'venue',
			'space',
			'space.packageVenueTypes',
			'space.packageSubCategories',
			'venues',
			'teams',
			'venueTypes',
			'subCategories',
		],
		withCanceled?: boolean
	): Promise<SubscriptionEntity[]> {
		winstonLogger.info(`_getSubscriptionsByUserId: userId: ${userId}`);
		if (typeof userId === 'undefined') return [];
		let where: FindOptionsWhere<SubscriptionEntity>[] = [
			{
				userId: Number(userId),
				isOngoing: true,
			},
		];

		if (withCanceled) {
			where.push({
				userId: Number(userId),
				status: SubscriptionStatus.CANCELED,
			});
			where.push({
				userId: Number(userId),
				status: SubscriptionStatus.DELETED,
			});
			where.push({
				userId: Number(userId),
				status: SubscriptionStatus.INACTIVE,
			});
		}

		const userSubIds = await MainDataSource.getRepository(SubscriptionEntity).find({
			where,
			select: ['id'],
		});
		const userTeamsIds = await MainDataSource.getRepository(TeamMemberEntity).find({
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
				memberId: +userId,
				status: Not(TeamMemberStatus.MEMBER_REMOVED),
				team: {
					subscriptions: {
						isOngoing: true,
					},
				},
			},
		});

		const flatTeamIds =
			userTeamsIds && Array.isArray(userTeamsIds)
				? userTeamsIds.map((i) => i.team?.subscriptions?.map((s: SubscriptionEntity) => s.id)).flat()
				: [];

		const subscriptions = await MainDataSource.getRepository(SubscriptionEntity).find({
			where: {
				id: In([...flatTeamIds, ...(userSubIds && Array.isArray(userTeamsIds) ? userSubIds.map((s) => s.id) : [])]),
			},
			relations,
		});

		subscriptions.forEach(async (s: SubscriptionEntity) => {

		const currentSpaceDetails = await MainDataSource.getRepository(SpaceEntity).findOne({
			where: {
				id:s.spaceId
			},
		});
		if(currentSpaceDetails)
		s.space = currentSpaceDetails
	})

		return subscriptions;
	}

	/**
	 * Validate user on request
	 * @param {string} value - username
	 * @param {string | undefined} userId - user ID
	 * @returns {Promise<boolean>}
	 */
	async _nameValidator(value: string, userId: string | undefined): Promise<boolean> {
		winstonLogger.info(`_nameValidator: value: ${value}, userId: ${userId}`);
		const item = await MainDataSource.getRepository(UserEntity).findOne({ where: { username: value }, select: ['id', 'username'] });
		winstonLogger.info(`_nameValidator: item: ${item}`);
		if (!item || String(item.id) === String(userId)) return true;
		throw new ForbiddenResponse({ message: `User with username ${value} already exist` });
	}

	/**
	 * User phone validation
	 * @param {string} value - phone number
	 * @param {string | undefined} userId - user ID
	 * @returns {Promise<boolean>}
	 */
	async _phoneValidator(value: string, userId: string | undefined): Promise<boolean> {
		winstonLogger.info(`_phoneValidator: value: ${value}, userId: ${userId}`);
		winstonLogger.info(`_phoneValidator: userEntiry: ${UserEntity}`);
		const repo = MainDataSource.getRepository(UserEntity);
		const item = await repo.createQueryBuilder('User').andWhere(`phone = :value`, { value }).getOne();
		winstonLogger.info(`_phoneValidator: item: ${item}`);
		if (!item || (userId && String(item.id) === String(userId))) return true;
		throw new ForbiddenResponse({ message: `User with phone ${value} already exist` });
	}

	/**
	 * Validate suers import. Must be unique username, email and phone.
	 * @param {string} username - Username
	 * @param {string} phone - Phone number
	 * @param {string} email - Email
	 *
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<ValidateImportInterface>}
	 */
	async _validateImport(
		{ username, phone, email }: ImportUsersValidateDto,
		requestedByUser?: UserEntity | undefined
	): Promise<ValidateImportInterface> {
		if (requestedByUser && requestedByUser.role?.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(UserEntity);
		const item = await repo
			.createQueryBuilder('User')
			.orWhere(`phone = :phone`, { phone })
			.orWhere(`username = :username`, { username })
			.orWhere(`email = :email`, { email })
			.getOne();

		if (typeof item === 'undefined') return new ImportUsersValidateResp({ isValidPhone: true, isValidEmail: true, isValidUsername: true });

		return new ImportUsersValidateResp({
			isValidPhone: String(item?.phone) !== String(phone),
			isValidEmail: item?.email !== email,
			isValidUsername: item?.username !== username,
		});
	}

	/**
	 * Validate email and check if its already registred
	 * @param {string} value - Email
	 * @param {string | undefined} userId - User ID
	 * @returns {Promise<boolean>}
	 */
	async _emailValidator(value: string, userId: string | undefined): Promise<boolean> {
		winstonLogger.info(`_emailValidator: value: ${value}, userId: ${userId}`);
		const isValid = await ValidateEmailHelper(value);

		winstonLogger.info(`_emailValidator: isValid: ${isValid}`);
		if (!isValid) throw new ForbiddenResponse({ message: `Value ${value} is not valid email address` });

		const repo = MainDataSource.getRepository(UserEntity);
		const item = await repo.createQueryBuilder('User').andWhere(`email = :value`, { value }).getOne();
		winstonLogger.info(`_emailValidator: item: ${item}`);

		if (!item) return true;
		if (userId && String(item.id) === String(userId)) return true;

		throw new ForbiddenResponse({ message: `Email ${value} is already taken` });
	}

	/**
	 * Deducts user credits and save credits rotation entity based on invoice items
	 * @param { number | string } userId - user ID
	 * @param { number | string } invoiceId - invoice ID
	 * @param { HoursType } creditsType - type of credits to save
	 * @param { boolean } isCron
	 * @return { Promise<void> }
	 */
	async _saveUserCredits(userId: number | string | undefined, invoiceId: number | string, creditsType: HoursType, isCron?: boolean): Promise<void> {
		if (!invoiceId || !userId) return;

		winstonLogger.info(`_saveUserCredits: userId: ${userId}, invoiceId: ${invoiceId}, creditsType: ${creditsType}, isCron: ${isCron}`);
		const subService = new SubscriptionService();

		const subs = await UserService._getSubscriptionsByUserId(userId, ['creditHours']);

		if (!subs) return;

		const invoice = await MainDataSource.getRepository(InvoiceEntity)
			.createQueryBuilder('invoice')
			.where(`invoice.id = :invoiceId`, { invoiceId })
			.leftJoinAndSelect('invoice.items', 'items')
			.select('invoice.id')
			.addSelect('items.id')
			.addSelect('items.creditHours')
			.getOne();

		winstonLogger.info(`_saveUserCredits: invoice: ${invoice}`);
		if (invoice) {
			await Promise.all(
				invoice.items.map((item) => {
					if (!item.creditHours || item.creditHours === 0) return;
					let itemCreditHours = Number(Number(item.creditHours).toFixed(2));

					if (!subs) return [];
					return subs.map(async (s: SubscriptionEntity) => {
						if (!s.creditHours || itemCreditHours <= 0) return;

						const creditsObj = s.creditHours.find((ch: SubscriptionCreditHoursEntity) => ch.type === creditsType);

						if (!creditsObj || creditsObj.given === 0) return;

						let usedHours: number = Number(itemCreditHours);

						if (creditsObj.given <= itemCreditHours) {
							usedHours = Number(creditsObj.given);
						}

						if (creditsObj.given > itemCreditHours) {
							itemCreditHours = 0;
						} else {
							itemCreditHours -= Number(creditsObj.given);
						}

						await subService.changeCreditHours({
							type: creditsType,
							rotationType: isCron ? CreditRotationType.CRON : CreditRotationType.SPACE,
							hours: usedHours,
							userId: Number(userId),
							createdById: Number(userId),
							subscriptionId: s.id,
							invoiceItemId: item.id,
						});
					});
				})
			);
		}
	}

	/**
	 *
	 * @param userId
	 * @param spaceIdsArray
	 * @param creditsToDeduct
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<{ spaceId: number; creditBalance: number; creditHours: number; billable: number }[]>}
	 */
	async _calcSpaceHours(
		userId: number | string,
		spaceIdsArray: Array<string | number>,
		creditsToDeduct?: string | number | undefined,
		requestedByUser?: UserEntity | undefined
	): Promise<UserSpaceHoursResponse[]> {
		let requestedCredits = creditsToDeduct ? Number(creditsToDeduct) : 0;
		const totalHours = creditsToDeduct ? Number(creditsToDeduct) : 0

		const subs = await UserService._getSubscriptionsByUserId(userId);
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: +userId } });
		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		const defaultBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({
			where: { name: DEFAULT_BRAND_NAME },
			select: { id: true },
		});
		const defaultBrandId = defaultBrand.id;

		const spacesArray = await MainDataSource.getRepository(SpaceEntity)
			.createQueryBuilder('space')
			.leftJoinAndSelect('space.venue', 'venue')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.whereInIds(spaceIdsArray)
			.select(['space.id', 'space.notAllowCredit', 'space.quantity', 'space.credits2x', 'space.creditsHalf', 'space.chargeType', 'space.price'])
			.addSelect('venue.brandId')
			.addSelect('spaceType.logicType')
			.getMany();

		return spacesArray
			.filter((s) => s.spaceType && [SpaceTypeLogicType.HOURLY, SpaceTypeLogicType.MINUTELY].includes(s.spaceType.logicType))
			.map((s) => {
				let userCredits = 0;
				subs.forEach((sub: SubscriptionEntity) => {
					const chType = s.spaceType && s.spaceType.logicType === SpaceTypeLogicType.HOURLY ? 'conference' : 'check-in';
					if (
						(s.venue && s.venue.brandId !== user.brandId && sub.brandId === defaultBrandId) ||
						(s.venue && [sub.brandId, user.brandId].includes(s.venue.brandId))
					) {
						userCredits += sub.creditHours
							? sub.creditHours
									.filter((ch: SubscriptionCreditHoursEntity) => ch.type === chType)
									.map((ch) => ch.given)
									.reduce((a: number, b: number) => a + b, 0)
							: 0;
					}
				});
				if (s.notAllowCredit) {
					return new UserSpaceHoursResponse({
						spaceId: s.id,
						creditBalance: userCredits,
						creditHours: 0,
						billable: Number(requestedCredits),
					});
				}

				if (s.credits2x) requestedCredits *= 2;
				if (s.creditsHalf) requestedCredits /= 2;

				const creditHours = requestedCredits < userCredits ? requestedCredits : userCredits;

				return new UserSpaceHoursResponse({
					spaceId: s.id,
					creditBalance: userCredits,
					creditHours,
					billable: creditHours <= requestedCredits ? (s.credits2x? (requestedCredits - creditHours)/2 : totalHours - creditHours) : 0,
				});
			});
	}

	/**
	 * @typedef {Object} ExistParams
	 * @property {String} [email]
	 * @property {String} [username]
	 */

	/**
	 * Check if user already exist
	 * @param {ExistParams} params
	 * @returns {Promise<number>}
	 */
	checkExist(params: { email?: string; username?: string }): Promise<number> {
		winstonLogger.info(`checkExist: params: ${params}`);
		return MainDataSource.getRepository(UserEntity).count({ where: params });
	}

	async getUserStripeKey(userId: number): Promise<UserEntity|null> {
		const userQ = MainDataSource.getRepository(UserEntity)
		.createQueryBuilder('User')
		.leftJoinAndSelect('User.brand', 'brand')
		.select('User.id')
		.addSelect('User.stripeCustomerId')
		.addSelect('User.email')
		.addSelect('brand.id')
		.addSelect('brand.stripePublicKey')
		.where('User.id=:userId', { userId });

		const user = await userQ.getOne();
		return user;
	}
	
	/**
	 * Get user by username
	 * @param {string} username - Username
	 * @returns {Promise<UserEntity | null>}
	 */
	getByUsername(username: string): Promise<UserEntity | null> {
		return MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('User')
			.leftJoinAndSelect('User.teamMembership', 'teamMembership', 'teamMembership.status != :memberRemovedStatus', {
				memberRemovedStatus: TeamMemberStatus.MEMBER_REMOVED,
			})
			.addSelect('User.password')
			.andWhere(`User.username= :username`, { username })
			.getOne();
	}

	/**
	 * Get user by email
	 * @param {string} email - Email
	 * @returns {Promise<UserEntity | null>}
	 */
	getByEmail(email: string): Promise<UserEntity | null> {
		return MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('User')
			.leftJoinAndSelect('User.photo', 'photo')
			.andWhere(`User.email= :email`, { email })
			.getOne();
	}

	/**
	 * Get user by email
	 * @param {string} stripeCustomerId - Customer ID in Stripe
	 * @returns {Promise<UserEntity | null>}
	 */
	getByStripeCustomerId(stripeCustomerId: string): Promise<UserEntity> {
		return MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('User')
			.leftJoinAndSelect('User.photo', 'photo')
			.andWhere(`User.stripeCustomerId= :stripeCustomerId`, { stripeCustomerId })
			.getOneOrFail();
	}

	/**
	 * Get user by phone number
	 * @param {number} phone - Phone number
	 * @returns {Promise<UserEntity>}
	 */
	getByPhone(phone: number): Promise<UserEntity> {
		return MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { phone } });
	}

	/**
	 * Get user profile
	 * @param {number | string} profileId - Requested profile ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity>}
	 */
	async single(profileId: number | string, requestedByUser?: UserEntity | undefined): Promise<UserEntity> {
		if (!requestedByUser) throw new ForbiddenResponse();

		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
			where: { id: +profileId },
			relations: ['role', 'role.permissions', 'photo', 'adminVenues', 'brand', 'brand.logo','brand.brandCategories','brand.brandCategories.subCategories', 'leadingTeams', 'adminVenues.blockOutDates'],
		});

		user.teamMembership = await MainDataSource.getRepository(TeamMemberEntity).find({
			where: { memberId: +profileId, status: Not(TeamMemberStatus.MEMBER_REMOVED) },
			relations: ['team'],
		});

		if (
			requestedByUser?.isSuperAdmin() ||
			Number(user.brandId) === Number(requestedByUser.brandId) ||
			Number(user.id) === Number(requestedByUser.id)
		) {
			user.subscriptions = await UserService._getSubscriptionsByUserId(profileId, undefined, true);

			user.cards = await this.getCards(+profileId, requestedByUser);

			return user;
		}
		throw new ForbiddenResponse();
	}

	/**
	 * Get user deposit amount
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<{deposit: number}>}
	 */
	async getDeposit(userId: number, requestedByUser?: UserEntity | undefined): Promise<{ deposit: number }> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: Number(userId) } });
		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		const invoiceItems = await MainDataSource.getRepository(InvoiceItemEntity)
			.createQueryBuilder('InvoiceItem')
			.andWhere(`InvoiceItem.invoice.userId = :userId`, { userId })
			.andWhere('InvoiceItem.paid=:paid', { paid: true })
			.andWhere('InvoiceItem.refunded=:refunded', { refunded: false })
			.andWhere('InvoiceItem.invoiceItemType.name=:itemType', { itemType: 'security_deposit' })
			.select(['price', 'amountRefunded'])
			.getMany();

		let itemsDeposit =
			invoiceItems && Array.isArray(invoiceItems)
				? invoiceItems
						.map((item: InvoiceItemEntity) => parseFloat(String(item.price)) + parseFloat(String(item.amountRefunded)))
						.reduce((a, b) => a + b, 0)
				: 0;
		itemsDeposit += parseFloat(String(user.securityDeposit));
		return new UserDepositResponse({ deposit: itemsDeposit });
	}

	/**
	 * Get user companies
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyEntity[]>}
	 */
	async getCompany(userId: number, requestedByUser?: UserEntity | undefined): Promise<CompanyEntity[]> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(CompanyMemberEntity);
		const userMemberIn = await repo.find({
			where: [
				{ userId: Number(userId), status: ApprovalStatus.APPROVED },
				{ userId: Number(userId), status: ApprovalStatus.PENDING },
			],
			select: ['companyId'],
		});

		let request = MainDataSource.getRepository(CompanyEntity)
			.createQueryBuilder('Company')
			.leftJoinAndSelect('Company.photos', 'photos')
			.leftJoinAndSelect('Company.createdBy', 'createdBy')
			.leftJoinAndSelect('Company.brand', 'brand')
			.where('Company.createdById=:userId', { userId });

		if (userMemberIn.length) {
			request = request.orWhereInIds([...new Set(userMemberIn.map((cm: { companyId: string | number }) => cm.companyId))]);
		}

		return request.getMany();
	}

	async _saveAttachments(id: string | number, base64String: string): Promise<FileEntity> {
		const image64 = await prepareImage(base64String, 768);
		return await uploadToS3(image64, 'user', String(id), String(new Date().valueOf()));
	}

	/**
	 * Update single user profile to simple profile update
	 * @param {string} id User ID
	 * @param {Partial<UserEntity>} data - New (updated) user data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity | undefined>}
	 */
	async updateProfile(id: string, data: Partial<UserEntity>, requestedByUser?: UserEntity | undefined): Promise<UserEntity | undefined> {
		const cloneData = data;

		winstonLogger.info(`updateProfile: id: ${id}, data: ${data}, requestedByUser: ${requestedByUser}`);
		// @ts-ignore
		delete cloneData.updatedById;

		const repo = MainDataSource.getRepository(UserEntity);
		const user = await repo.findOneOrFail({ where: { id: Number(id) }, relations: { subscriptions: true } });

		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (cloneData.uploadAttachments) {
			try {
				cloneData.photo = await this._saveAttachments(id, cloneData.uploadAttachments[0]);
				delete cloneData.uploadAttachments;
			} catch (e) {
				loggerHelper.error('image saving failed - ', e);
			}
		}

		await repo.save({ ...user, ...cloneData });

		// update user team membership with new email
		if (cloneData.email && user.email !== cloneData.email) {
			winstonLogger.info(`updateProfile: update team membership with new email: ${cloneData.email}`);
			const userMembership = await MainDataSource.getRepository(TeamMemberEntity).find({
				where: [{ email: user.email }, { memberId: user.id }],
			});
			await Promise.all(
				userMembership.map(async (membership) => {
					await MainDataSource.getRepository(TeamMemberEntity).save({ ...membership, email: cloneData.email });
				})
			);
		}

		await this.stripeService.updateUserInfo(user.id);
		return user;
	}

	async changePassword(userId: number, { newPass }: { newPass: string }, requestedByUser: UserEntity) {
		const repo = MainDataSource.getRepository(UserEntity);
		const tokenRepo = MainDataSource.getRepository(TokenEntity);
		const userTokens = await tokenRepo.find({ where: { userId } });
		const user = await repo.findOneOrFail({ where: { id: userId } });

		user.password = newPass;

		await tokenRepo.remove(userTokens);
		await repo.save(user);

		Socket.connection().sendEventToUser(String(userId), SocketEventsType.PASSWORD_CHANGED, {
			message: 'Password changed.',
		});
	}

	/**
	 * Update single user member data to update member with relations
	 * @param {number} id - User id
	 * @param {UpdateUserDto} data - User data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity | undefined>}
	 */
	async updateMember(id: number, data: UpdateUserDto, requestedByUser?: UserEntity | undefined): Promise<UserEntity | undefined> {
		winstonLogger.info(`updateMember: id: ${id}, data: ${data}, requestedByUser: ${requestedByUser}`);
		const userUpdateData: Partial<UserEntity> = data;

		const repo = MainDataSource.getRepository(UserEntity);
		const user = await repo.findOneOrFail({ where: { id }, relations: { adminVenues: true } });
		winstonLogger.info(`updateMember: user: ${user}`);

		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (data.uploadAttachments) {
			try {
				userUpdateData.photo = await this._saveAttachments(id, data.uploadAttachments[0]);
			} catch (e) {
				loggerHelper.error('image saving failed - ', e);
			}
		}

		if (typeof data.roleId !== 'undefined') {
			userUpdateData.isAdmin = false;
			try {
				const role = await MainDataSource.getRepository(RoleEntity).findOneOrFail({ where: { id: data.roleId } });
				if ([BrandRoleType.VENUE_ADMIN, BrandRoleType.ADMIN, BrandRoleType.SUB_SUPERADMIN].includes(role.roleType))
					userUpdateData.isAdmin = true;
				if (user.adminVenues && user.adminVenues.length && role.roleType !== BrandRoleType.VENUE_ADMIN) {
					userUpdateData.adminVenues = [];
				}
				userUpdateData.role = role;
			} catch (e) {
				loggerHelper.error(e);
			}
		}

		const returnUser = await repo.save({ ...user, ...userUpdateData });

		if (user.stripeCustomerId) await this.stripeService.updateUserInfo(user.id);
		else await this.stripeService.createUser(user.id);

		return returnUser;
	}

	/**
	 * Create single user
	 * @param {CreateUserDto} data - CreateUserDto
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity>}
	 */
	async create(data: CreateUserDto, requestedByUser?: UserEntity | undefined): Promise<UserEntity> {
		if (requestedByUser && requestedByUser.role.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();

		winstonLogger.info(`create: data: ${data}, requestedByUser: ${requestedByUser}`);
		const cloneData = data;
		const companyService = new CompanyService();
		const teamService = new TeamService();

		const { teamName, companyId, teamId, createdById } = cloneData;
		winstonLogger.info(`create: teamName: ${teamName}, companyId: ${companyId}, teamId: ${teamId}, createdById: ${createdById}`);

		// @ts-ignore
		delete cloneData.teamName;

		const companyMemberRepo = MainDataSource.getRepository(CompanyMemberEntity);
		winstonLogger.info(`create: companyMemberRepo: ${companyMemberRepo}`);

		const company = cloneData.company ? cloneData.company : null;
		const memberCompanyId = companyId || null;

		if (cloneData.company) {
			// @ts-ignore
			delete cloneData.company;
		}

		if (typeof cloneData.isAdmin === 'undefined') {
			cloneData.isAdmin = false;
			if (cloneData.roleId)
				try {
					const role = await MainDataSource.getRepository(RoleEntity).findOneOrFail({ where: { id: cloneData.roleId } });
					if ([BrandRoleType.VENUE_ADMIN, BrandRoleType.ADMIN, BrandRoleType.SUB_SUPERADMIN].includes(role.roleType))
						cloneData.isAdmin = true;
				} catch (e) {
					loggerHelper.error(e);
				}
		}

		cloneData.status = UserStatus.ACTIVE;

		winstonLogger.info(`cloneData: ${cloneData.brandId}`)

		let { brandId } = cloneData;

		winstonLogger.info(`brandId: ${brandId}`)

		/**
		 * Request from unauthorized user
		 */
		if (!brandId) {
			try {
				const defaultBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({ where: { name: DEFAULT_BRAND_NAME } });
				brandId = defaultBrand.id;
				console.log("line number 770: "+brandId)
				cloneData.brandId = defaultBrand.id;
			} catch (e) {
				loggerHelper.error(e);
				throw new ForbiddenResponse({ message: 'Wrong role used!' });
			}
		}

		if(teamId)
		{
			const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: Number(teamId) } });
			cloneData.brandId = team.brandId;
			brandId = team.brandId;
		}

		if (!cloneData.roleId) {
			const roleParams: { roleType: BrandRoleType; brandId?: number; name?: string } = { roleType: BrandRoleType.MEMBER, name: "DefaultDDMember" };

			if (brandId) {
				roleParams.brandId = Number(brandId);
			} else {
				roleParams.name = DEFAULT_ROLE_NAME;
			}

			try {
				const role = await MainDataSource.getRepository(RoleEntity).findOne({ where: roleParams });
				if (role) cloneData.roleId = role.id;
				else {
					const memberRoleParams: { roleType: BrandRoleType; name: string } = {
						roleType: BrandRoleType.MEMBER,
						name: 'Pre-defined member',
					};
					const memberRole = await MainDataSource.getRepository(RoleEntity).findOneOrFail({ where: memberRoleParams });
					cloneData.roleId = memberRole.id;
				}
			} catch (e) {
				loggerHelper.error(e);
			}
		}

		// @ts-ignore
		const item = MainDataSource.getRepository(UserEntity).create({ ...cloneData, company: undefined } as UserEntity);
		const newUser = await MainDataSource.getRepository(UserEntity).save(item);

		await this.stripeService.createUser(newUser.id);

		if (memberCompanyId) {
			const memberData = {
				userId: newUser.id,
				companyId: Number(memberCompanyId),
				createdById: requestedByUser?.id || newUser.id,
				status: ApprovalStatus.APPROVED,
				dateApproved: new Date(),
				createAt: new Date(),
			};
			const newMembership = companyMemberRepo.create(memberData);
			await companyMemberRepo.save(newMembership);
		}

		let savedCompany: CompanyEntity;

		if (company) {
			company.brandId = Number(brandId);
			company.userId = requestedByUser?.id || newUser.id;
			if (company.image) {
				const attachment = company.image;
				company.uploadAttachments = [String(attachment)];
			}
			savedCompany = await companyService.create(company);
		}

		let userPhotoUrl = '';

		if (cloneData.uploadAttachments) {
			try {
				const image64 = await prepareImage(cloneData.uploadAttachments[0], 128);
				const file = await uploadToS3(image64, 'user', String(newUser.id), String(new Date().valueOf()));
				userPhotoUrl = file.url;
				await MainDataSource.getRepository(UserEntity).update(newUser.id, { photoFileId: file.id });
			} catch (e) {
				loggerHelper.error('image saving failed - ', e);
			}
		}

		/**
		 * If user creates like team lead
		 * 1. Create new team with team lead id of newly created user.
		 * 2. Add team to company user selected or created.
		 * 3. Add subscription to newly created team
		 */
		loggerHelper.error('teamId - ', teamId);

		// create new team
		if (teamName) {
			try {
				const newTeam = await teamService.create(
					{
						name: teamName,
						brandId: Number(brandId),
						teamLeadId: newUser.id,
						createdById: requestedByUser?.id || newUser.id,
					},
					newUser
				);

				if (companyId || company) {
					// @ts-ignore
					await companyService.addTeam(String(savedCompany?.id || companyId), String(newTeam.id), newUser);
				}
			} catch (e) {
				loggerHelper.error('team saving failed - ', e);
			}
		}

		// add newly created user to team
		if (teamId) {
			await teamService.addMember(
				{
					teamId: +teamId,
					memberId: newUser.id,
					email: newUser.email,
					status: TeamMemberStatus.ACCOUNT_CREATED,
					createdById,
				},
				newUser
			);
		}
		console.log('calling sendEmail from sendUserdefinedTemplate send-mail.helper.ts line 876');
		await sendUserDefinedTemplate('Welcome to Brand', {
			brandId: Number(brandId),
			user: {
				firstName: cloneData.firstname,
				lastName: cloneData.lastname,
				password: cloneData.password,
				username: cloneData.username,
				fullname: `${cloneData.firstname} ${cloneData.lastname}`,
				email: cloneData.email,
				photo: userPhotoUrl !== '' ? `${AWS_URL}/434x176${userPhotoUrl}` : `https://${DOMAIN}/images/header/default-avatar.png`,
				phone: cloneData.phone,
			},
			emailTo: { address: String(cloneData.email), name: `${cloneData.firstname} ${cloneData.lastname}` },
		});

		return await this.single(newUser.id, newUser);
	}

	/**
	 * Get user credit cards from stripe API
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return {Promise<Stripe.Card[]>}
	 */
	async getCards(userId: number, requestedByUser?: UserEntity | undefined): Promise<Array<Stripe.Card> | []> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: Number(userId) } });
		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		try {
			const [stripe, stripeCustomerId] = await useStripe(userId, false);
			if (!stripeCustomerId || stripeCustomerId === '') return [];

			const cust: Stripe.Customer = (await stripe.customers.retrieve(stripeCustomerId)) as Stripe.Customer;
			let cardData = null;
				cardData = await stripe.paymentMethods.list({
					customer: stripeCustomerId,
					type: 'card',
				  });
			
				
			const {data} = cardData;		
			return data.map((d: any) => ({ ...d, isDefault: d.id === cust.default_source })) as CustomerCard[];
		} catch (e) {
			loggerHelper.error(e);
			return [];
		}
	}

	/**
	 * Set user default card
	 * @param {number} userId - User ID
	 * @param {string} cardId - STRIPE card id (id on stripe system)
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<Stripe.Card[]>}
	 */
	async setDefaultCard(userId: number, cardId: string, requestedByUser?: UserEntity | undefined): Promise<Array<Stripe.Card> | []> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const [stripe, stripeCustomerId] = await useStripe(userId, false);
		if (!stripeCustomerId || stripeCustomerId === '') throw new ForbiddenResponse({ message: 'No customer!' });

		Socket.connection().sendEventToUser(String(userId), SocketEventsType.USER_DATA_UPDATED, {
			message: 'User data changed.',
		});

		const customerInfo = await stripe.customers.update(stripeCustomerId, { default_source: cardId });
		return (customerInfo.sources?.data as Stripe.Card[]) || [];
	}

	/**
	 * Update user card
	 * @param {number} userId - User ID
	 * @param {string} cardId - STRIPE card id (id on stripe system)
	 * @param {Stripe.CustomerSourceUpdateParams} cardData - card number, exp. month, exp. year etc
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<Stripe.Card>}
	 */
	async updateCard(
		userId: number,
		cardId: string,
		cardData: Stripe.CustomerSourceUpdateParams,
		requestedByUser?: UserEntity | undefined
	): Promise<Stripe.Card> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const [stripe, stripeCustomerId] = await useStripe(userId, false);
		if (!stripeCustomerId || stripeCustomerId === '') throw new ForbiddenResponse({ message: 'No customer!' });

		Socket.connection().sendEventToUser(String(userId), SocketEventsType.USER_DATA_UPDATED, {
			message: 'User data changed.',
		});

		return (await stripe.customers.updateSource(stripeCustomerId, cardId, cardData)) as Stripe.Card;
	}

	/**
	 * Delete user CC
	 * @param {number} userId - User ID
	 * @param {string} cardId - STRIPE card id (id on stripe system)
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<Stripe.Card[]>}
	 */
	async deleteCard(userId: number, cardId: string, requestedByUser?: UserEntity | undefined): Promise<Array<Stripe.Card> | []> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const [stripe, stripeCustomerId] = await useStripe(userId, false);
		if (!stripeCustomerId || stripeCustomerId === ''){ throw new ForbiddenResponse({ message: 'No customer!' });}
		let cardData = null;
		cardData = await stripe.paymentMethods.list({
			customer: stripeCustomerId,
			type: 'card',
		  });
		
		
		const { data: preList } = cardData;
		// already no cards
		if (!preList.length) return [];

		// if its last user card we need to check for upcoming invoices
		if (preList.length === 1) {
			const invoceRepo = MainDataSource.getRepository(InvoiceEntity);
			const invoceStatusRepo = MainDataSource.getRepository(InvoiceStatusEntity);
			const upcomingStatus = await invoceStatusRepo.findOneOrFail({ where: { name: 'Upcoming' } });
			const upcomingInvoices = await invoceRepo.find({ where: { invoiceStatusId: upcomingStatus.id, userId: Number(userId) } });
			if (upcomingInvoices.length > 0) throw new ForbiddenResponse({ message: "Can't delete! Have upcoming invoices!" });
		}

		await stripe.customers.deleteSource(stripeCustomerId, cardId);

		Socket.connection().sendEventToUser(String(userId), SocketEventsType.USER_DATA_UPDATED, {
			message: 'User data changed.',
		});	  	
			cardData = await stripe.paymentMethods.list({
				customer: stripeCustomerId,
				type: 'card',
			  });
	
	const { data } = cardData;
		return data as unknown as Stripe.Card[];
	}

	/**
	 * Add user CC
	 * @param {number} userId - User ID
	 * @param {Stripe.TokenCreateParams.Card} card - card number, exp. month, exp. year etc
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<Stripe.Card[]>}
	 */
	async addCard(
		userId: number,
		card: Stripe.TokenCreateParams.Card,
		requestedByUser?: UserEntity | undefined
	): Promise<Array<StripeCardResp> | []> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const [stripe, customerId] = await useStripe(userId);

		const { id: paymentSourceId }: Stripe.Token = await stripe.tokens.create({
			card,
		});

		if (customerId && customerId !== '') {
			const cardSource = await stripe.customers.createSource(customerId, { source: paymentSourceId });

			const updatedCustomer: Stripe.Customer = await stripe.customers.update(customerId, {
				default_source: cardSource ? cardSource.id : undefined,
			});

			Socket.connection().sendEventToUser(String(userId), SocketEventsType.USER_DATA_UPDATED, {
				message: 'User data changed.',
			});

			return updatedCustomer?.sources?.data ? updatedCustomer?.sources?.data.map((c) => new StripeCardResp(c as Stripe.Card)) : [];
		} else {
			const newCustomer = await this.stripeService.createUser(user.id, paymentSourceId);
			if (newCustomer) {
			let cardData = null;
				cardData = await stripe.paymentMethods.list({
					customer: newCustomer.id,
					type: 'card',
				  })
		const { data } = cardData;
				return data.map((c) => new StripeCardResp(c as unknown as Stripe.Card));
			}
			return [];
		}
	}

	/**
	 * Add user CC
	 * @param {number} userId - User ID
	 * @param {Stripe.TokenCreateParams.Card} token 
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<Stripe.Card[]>}
	 */
	async addCardTokentoUser(
		userId: number,
		token: Stripe.Token,
		requestedByUser?: UserEntity | undefined
	): Promise<Array<StripeCardResp> | []> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const [stripe, customerId] = await useStripe(userId);		

		 if (customerId && customerId !== '' && token && token.id) {
		 	const cardSource = await stripe.customers.createSource(customerId, { source: token?.id });

			const updatedCustomer: Stripe.Customer = await stripe.customers.update(customerId, {
				default_source: cardSource ? cardSource.id : undefined,
			});

			Socket.connection().sendEventToUser(String(userId), SocketEventsType.USER_DATA_UPDATED, {
				message: 'User data changed.',
			});

			return updatedCustomer?.sources?.data ? updatedCustomer?.sources?.data.map((c) => new StripeCardResp(c as Stripe.Card)) : [];
		} 
			const newCustomer = await this.stripeService.createUser(user.id, token?.id);
			if (newCustomer) {
				const { data }= await stripe.paymentMethods.list({
					customer: newCustomer.id,
					type: 'card',
				  });
				return data.map((c) => new StripeCardResp(c as unknown as Stripe.Card));
			}
			return [];
		
	}

	/**
	 * Get users list with [params]{@link UserFilterInterface}
	 * @inheritDoc
	 * @param {UserFilterInterface} params - User search params
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(params: UserFilterInterface, requestedByUser?: UserEntity | undefined): Promise<[UserEntity[], number]> {
		let brandId = params.brandId || '';
		const {
			status,
			limit = 5,
			offset = 0,
			venueId,
			roleId,
			isAdmin,
			searchString,
			selectOnly,
			excludeSelf,
			// noTeamLead,
			inludeIds,
			teamLeadId,
			withCache,
			withBrand,
			withPhoto,
			withRole,
			// withCards,
			createdAtRange,
			withSubscriptions,
			withInvoices,
			withTeams,
			withCompanies,
		} = params;

		/**
		 * Request from unauthorized user
		 */
		if (!requestedByUser) {
			try {
				const ddBrand = await MainDataSource.getRepository(BrandEntity).findOneOrFail({ where: { name: DEFAULT_BRAND_NAME } });
				brandId = String(ddBrand.id);
			} catch (e) {
				loggerHelper.error(e);
			}
		}

		let query = MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('User')
			.addSelect('User.createdAt')
			.queryAndWhere(`User.status = :status`, { status })
			.queryAndWhere(`User.brand = :brandId`, { brandId })
			.queryAndWhere(`User.venueId = :venueId`, { venueId })
			.queryAndWhere(`User.roleId = :roleId`, { roleId })
			.queryAndWhere(`User.isAdmin = :isAdmin`, { isAdmin });

		if (teamLeadId) {
			const teamLeadTeams = await MainDataSource.getRepository(TeamEntity)
				.createQueryBuilder('team')
				.where({ teamLeadId })
				.select(['team.id', 'members.id'])
				.leftJoin('team.members', 'members')
				.getMany();
			const teamLeadMembers: number[] = [];
			teamLeadTeams.forEach((t) => t.members?.forEach((tm) => teamLeadMembers.push(tm.id)));
			query = query.andWhereInIds(teamLeadMembers);
		}

		if (withRole) query = query.leftJoinAndSelect('User.role', 'role');

		if (withPhoto) query = query.leftJoinAndSelect('User.photo', 'photo');

		if (withBrand) query = query.leftJoinAndSelect('User.brand', 'brand').leftJoinAndSelect('brand.logo', 'logo');

		if (withTeams)
			query = query
				.leftJoinAndSelect('User.teamMembership', 'teamMembership', 'teamMembership.status != :memberRemovedStatus', {
					memberRemovedStatus: TeamMemberStatus.MEMBER_REMOVED,
				})
				.leftJoinAndSelect('teamMembership.team', 'team');

		if (createdAtRange) {
			query = query
				.andWhere('User.createdAt >= :start', { start: dayjs(createdAtRange[0]).startOf('day').format() })
				.andWhere('User.createdAt < :end', { end: dayjs(createdAtRange[1]).endOf('day').format() });
		}

		if (inludeIds) {
			query = query.orWhereInIds(inludeIds);
		}

		if (excludeSelf && requestedByUser) {
			query = query.andWhere('User.id != :userId', { userId: requestedByUser.id });
		}

		if (searchString) {
			if (searchString.split(' ').length > 1) {
				query = query.andWhere(
					new Brackets((subQb) => {
						subQb
							.where(`LOWER(User.firstname) LIKE LOWER(:searchString)`, {
								searchString: `%${searchString.split(' ')[0]}%`,
							})
							.orWhere(`LOWER(User.lastname) LIKE LOWER(:searchString)`, {
								searchString: `%${searchString.split(' ')[1]}%`,
							});
						if (status) {
							subQb.andWhere(`User.status = :status`, { status });
						}
					})
				);
			} else {
				query = query.andWhere(
					new Brackets((subQb) => {
						subQb
							.where(`LOWER(User.firstname) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(User.lastname) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(User.username) LIKE LOWER(:searchString)`)
							.orWhere(`LOWER(User.email) LIKE LOWER(:searchString)`)
							.orWhere(`CAST(User.phone as VARCHAR) LIKE LOWER(:searchString)`);
						if (status) {
							subQb.andWhere(`User.status = :status`, { status });
						}
					}),
					{ searchString: `%${searchString}%` }
				);
			}
		}

		if (selectOnly && selectOnly.length > 0) {
			let selectArr = selectOnly;

			if (selectOnly.includes('subscriptions')) {
				query = query.leftJoinAndSelect('User.subscriptions', 'subscriptions');
				selectArr = selectArr.filter((i) => i !== 'subscriptions');
			}
			// if(selectOnly.includes('photo')) {
			// query = query.leftJoinAndSelect('User.photo', 'photo');
			// selectArr = selectArr.filter(i => i !=='subscriptions');
			// }
			if (selectOnly.includes('subscriptions.creditHours')) {
				query = query.leftJoinAndSelect('subscriptions.creditHours', 'creditHours');
				selectArr = selectArr.filter((i) => i !== 'subscriptions.creditHours');
			}

			query = query.select(selectArr);
		}

		query = query.take(limit).skip(offset);

		if (withCache) query = query.cache(true);

		// eslint-disable-next-line prefer-const
		let [res, count] = await query.getManyAndCount();

		// const invoicePastStatus
		res = await Promise.all(
			res.map(async (u) => {
				const clone = u;

				// if (withSubscriptions) clone.subscriptions = UserService._getUserSubscriptions(u);
				if (withSubscriptions) clone.subscriptions = await UserService._getSubscriptionsByUserId(u.id);
				// if (withCards) clone.cards = await this.getCards(String(userId));
				if (withInvoices) {
					const ltQuery = MainDataSource.getRepository(InvoiceEntity)
						.createQueryBuilder('invoice')
						.leftJoinAndSelect('invoice.invoiceStatus', 'invoiceStatus')
						.leftJoinAndSelect('invoice.providerData', 'providerData')
						.leftJoinAndSelect('invoice.reservation', 'reservation')
						.andWhere('invoice.userId=:invoiceUserId', { invoiceUserId: u.id })
						.andWhere('invoiceStatus.name NOT IN (:...invoiceStatuses)')
						.setParameter('invoiceStatuses', ['Upcoming', 'Upcoming-Hours'])
						.orderBy('invoice.id', 'DESC');

					clone.latestInvoice = (await ltQuery.getOne()) || undefined;
				}

				if (withCompanies) clone.companies = await this.getCompany(u.id, requestedByUser);

				return clone;
			})
		);

		return [res, count];
	}

	/**
	 * Send invite mail to users
	 * @param {string} brandId - Brand ID
	 * @param {string} teamId - Team ID
	 * @param {string[]} emails - Array of emails
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<void>}
	 */
	async inviteUsersToBrand(
		{ brandId, emails, teamId }: { brandId: string; emails: string[]; teamId?: string },
		requestedByUser?: UserEntity | undefined
	): Promise<void> {
		let teamName = '';
		let teamLeadName = '';

		winstonLogger.info(`inviteUsersToBrand: brandId: ${brandId}, emails: ${emails}, teamId: ${teamId}, requestedByUser: ${requestedByUser}`);
		if (requestedByUser && requestedByUser.role?.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();

		if (teamId) {
			const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({
				where: { id: Number(teamId) },
				relations: { teamLead: true },
			});
			teamName = team.name;
			teamLeadName = `${team.teamLead!.firstname} ${team.teamLead!.lastname}`;
		}

		await Promise.all(
			emails.map(async (email) => {
				const msgData = {
					brandId: Number(brandId),
					teamId,
					team: {
						teamName,
						teamLeadName,
					},
					email,
					emailTo: email,
					url: `https://${DOMAIN}/sign?teamId=${teamId}&fromInvite=`,
				};
				console.log('calling sendEmail from sendUserdefinedTemplate send-mail.helper.ts line 1273');
				await sendUserDefinedTemplate(teamId ? 'Invite users from team lead' : 'Invite members', msgData);
			})
		);
	}

	/**
	 * Import users array
	 * @param {CreateUserDto} usersArray - User data
	 * @param {UserEntity} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<void>}
	 */
	async importUsers(usersArray: CreateUserDto[], requestedByUser: UserEntity): Promise<void> {
		if (requestedByUser && requestedByUser.role?.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();

		winstonLogger.info(`importUsers: usersArray: ${usersArray}, requestedByUser: ${requestedByUser}`);
		if (Array.isArray(usersArray)) {
			await Promise.all(
				usersArray.map(async (userData: CreateUserDto) => {
					const user = await this.create(userData, requestedByUser);
					const msgData = {
						brandId: userData.brandId,
						emailTo: userData.email,
						url: `https://${DOMAIN}/sign?verifyEmail=${user.id}`,
						user: {
							firstName: user.firstname,
							lastName: user.lastname,
							fullname: `${user.firstname} ${user.lastname}`,
							email: user.email,
							photo: user.photo ? user.photo.url : `https://${DOMAIN}/images/header/default-avatar.png`,
							phone: user.phone,
							username: userData.username,
							password: userData.password,
						},
					};
					console.log('calling sendEmail from sendUserdefinedTemplate user.service.ts line 1307');
					await sendUserDefinedTemplate('User register', msgData);
				})
			);
		}
	}

	/**
	 * Delete user
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity>}
	 */
	async delete(userId: number, requestedByUser?: UserEntity | undefined): Promise<UserEntity> {
		const userRepo = MainDataSource.getRepository(UserEntity);
		const teamRepo = MainDataSource.getRepository(TeamEntity);
		const invRepo = MainDataSource.getRepository(InvoiceEntity);
		const subsRepo = MainDataSource.getRepository(SubscriptionEntity);

		const user = await userRepo.findOneOrFail({ where: { id: userId }, relations: { brand: true } });
		winstonLogger.info(`delete: user: ${JSON.stringify(user)}, requestedByUser: ${JSON.stringify(requestedByUser)}`);
		const userNameCognito = user.username;
		const userPoolIdValue = await getSecretValue("UserPoolIdSecret");
		const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
		const cognitoDeleteInput = { 
			UserPoolId: userPoolIdValue,
			Username: userNameCognito,
		  };

		winstonLogger.info(`delete: cognitoDeleteInput: ${JSON.stringify(cognitoDeleteInput)}`);

		const cognitoDeleteCommand = new AdminDeleteUserCommand(cognitoDeleteInput);
		
		winstonLogger.info(`delete: cognitoDeleteCommand: ${JSON.stringify(cognitoDeleteCommand)}`);
		
		if (!user._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		const invoices = await invRepo.find({ where: { userId } });

		if (invoices.length) {
			throw new ForbiddenResponse({ message: 'Cant delete: User has invoices.' });
		}

		const subs = await subsRepo.find({ where: { userId: Number(userId), isOngoing: true } });

		if (subs.length) {
			throw new ForbiddenResponse({ message: 'Cant delete: User has active subscriptions.' });
		}

		const userCompanies = await MainDataSource.getRepository(CompanyEntity).find({
			where: { createdById: Number(userId) },
			relations: ['members'],
		});
		const userTeams = await MainDataSource.getRepository(TeamEntity).find({ where: { teamLeadId: Number(userId) }, relations: ['members'] });

		if (userTeams.length)
			userTeams.forEach((t) => {
				if (t.members && t.members.length) throw new ForbiddenResponse({ message: 'Cant delete: User has team with team members.' });
			});

		if (userCompanies.length)
			userCompanies.forEach((c) => {
				if (c.members && c.members.length) throw new ForbiddenResponse({ message: 'Cant delete: User has company with company members.' });
			});

		const userMemberInCompany = await MainDataSource.getRepository(CompanyMemberEntity).find({ where: { userId: Number(userId) } });
		if (userMemberInCompany.length) {
			await MainDataSource.getRepository(CompanyMemberEntity).remove(userMemberInCompany);
		}
		const userMemberInTeams = await teamRepo
			.createQueryBuilder('t')
			.leftJoinAndSelect('t.members', 'members')
			.where('members.id = :userId', { userId })
			.getMany();

		if (userMemberInTeams.length) {
			await Promise.all(
				userMemberInTeams.map(async (t) => {
					const tc = { ...t };
					tc.members = t.members!.filter((u) => u.id !== Number(userId));
					teamRepo.save(tc);
				})
			);
		}

		await userRepo.remove(user);
		try {
			const cognitoDeleteResponse = await cognitoClient.send(cognitoDeleteCommand);
			winstonLogger.info(`delete: cognitoDeleteResponse: ${JSON.stringify(cognitoDeleteResponse)}`);
		} catch (error) {
			winstonLogger.error(`delete: cognitoDeleteError: ${JSON.stringify(error)}`);
		}

		return user;
	}

	/**
	 * Suspend user
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<void>}
	 */
	async suspendUser(userId: number, requestedByUser?: UserEntity | undefined): Promise<void> {
		const userRepo = MainDataSource.getRepository(UserEntity);
		const user = await userRepo.findOneOrFail({ where: { id: userId }, relations: { brand: true } });
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const subsRepo = MainDataSource.getRepository(SubscriptionEntity);

		if (user.status === UserStatus.SUSPENDED) {
			await this.activateUser(userId, requestedByUser);
			return;
		}

		const subs = await subsRepo.find({ where: { userId: userId, isOngoing: true } });
		await Promise.all(
			subs.map(async (sub: SubscriptionEntity) => {
				const clone = sub;
				clone.isOngoing = false;
				clone.status = SubscriptionStatus.CANCELED;
				await subsRepo.save(clone);
			})
		);

		user.status = UserStatus.SUSPENDED;
		await userRepo.save(user);

		if(userId == requestedByUser?.id){		
			const message = (`Hello ${user.username},<br><br> Your DropDesk account has been deactivated. Your account will be deleted after 48 hours. If you did not request your account to be terminated, please reach out to support@dropdesk.io.
			<br>
			<br>
			Regards,<br> 
			The DropDesk Team.`).toString();
			return await sendAccountNotificationsToUser( 'Your DropDesk account has been deactivated.', user , message)
		}
		return await sendPredefinedTemplate('user-suspend', {
			subject: 'Your access has been revoked',
			brandId: user.brandId as unknown as number,
			emailTo: { address: user.email, name: `${user.firstname} ${user.lastname}` },
			user: {
				firstName: user.firstname,
				lastName: user.lastname,
				fullname: `${user.firstname} ${user.lastname}`,
				email: user.email,
				photo: user.photo ? user.photo.url : `https://${DOMAIN}/images/header/default-avatar.png`,
				phone: user.phone,
			},
		});
	}

	/**
	 * Re-Activate previously deleted, suspended or moved out user
	 * @param {number} userId - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity>}
	 */
	async activateUser(userId: number, requestedByUser?: UserEntity | undefined): Promise<UserEntity> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (requestedByUser && requestedByUser.role?.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const userRepo = MainDataSource.getRepository(UserEntity);

		user.status = UserStatus.ACTIVE;
		return await userRepo.save(user);
	}

	async saveFcmToken(userId: number, body?: any | undefined): Promise<UserEntity> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		let userUpdateData: Partial<UserEntity> = user;
		const userRepo = MainDataSource.getRepository(UserEntity);
		userUpdateData.fcmtoken = body?.fcmtoken != null ? body?.fcmtoken : user.fcmtoken;
		userUpdateData.isfcmtokenactive = body?.isfcmtokenactive?  body?.isfcmtokenactive : true;
		userUpdateData.isnotificationpermitted = body?.isnotificationpermitted?  body?.isnotificationpermitted : user.isnotificationpermitted;
		const returnUser = await userRepo.save({ ...user, ...userUpdateData });
		return returnUser;
	}
	/**
	 * Move out user
	 * @param {number} userId - User ID
	 * @param {{returnNote: string, manualAmount: number}} body - Refund info
	 * @param {number} adminId - Admin ID (user ID who do move out)
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<UserEntity>}
	 */
	async moveOutUser(userId: number, adminId: number, requestedByUser?: UserEntity | undefined): Promise<UserEntity> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: userId } });
		if (requestedByUser && requestedByUser.role?.roleType === BrandRoleType.MEMBER) throw new ForbiddenResponse();
		if (!user._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		try {
			const subService = new SubscriptionService();

			const subsRepo = MainDataSource.getRepository(SubscriptionEntity);
			const refundRepo = MainDataSource.getRepository(RefundEntity);
			const itemsRepo = MainDataSource.getRepository(InvoiceItemEntity);
			const userRepo = MainDataSource.getRepository(UserEntity);

			const user = await userRepo.findOneOrFail({ where: { id: userId }, relations: { brand: true } });

			if (user.status === UserStatus.MOVEOUT) return this.activateUser(userId, requestedByUser);

			const refund = refundRepo.create({
				amount: 0,
				note: '',
				returnDate: new Date(),
				updatedAt: new Date(),
				createdAt: new Date(),
				userId: user.id,
				createdById: adminId,
			});

			await refundRepo.save(refund);

			const invoiceItems = await itemsRepo
				.createQueryBuilder('InvoiceItem')
				.leftJoinAndSelect('InvoiceItem.invoice', 'invoice')
				.where(`invoice.userId = :userId`, { userId })
				.andWhere('InvoiceItem.paid=:paid', { paid: true })
				.andWhere('InvoiceItem.refunded=:refunded', { refunded: false })
				.andWhere('InvoiceItem.invoiceItemType=:itemType', { itemType: 'security_deposit' })
				.getMany();

			await Promise.all(
				invoiceItems.map(async (item: InvoiceItemEntity) => {
					const clone = item;
					clone.amountRefunded = item.price;
					clone.refunded = true;
					await itemsRepo.save(clone);
				})
			);

			const userSubs = await subsRepo.find({ where: { userId, isOngoing: true } });
			await Promise.all(
				userSubs.map(async (sub: SubscriptionEntity) => {
					await subService.delete(sub.id, requestedByUser);
				})
			);

			try {
				await sendPredefinedTemplate('user-move-out', {
					subject: 'Your account is not active',
					brandId: user.brandId as unknown as number,
					emailTo: { address: user.email, name: `${user.firstname} ${user.lastname}` },
					user: {
						firstName: user.firstname,
						lastName: user.lastname,
						fullname: `${user.firstname} ${user.lastname}`,
						email: user.email,
						// photo: user.phone,
						phone: user.phone,
					},
				});
			} catch (e) {
				loggerHelper.error(e);
			}

			user.status = UserStatus.MOVEOUT;
			user.securityDeposit = 0;
			user.securityDepositToRevenue = 0;

			return await userRepo.save(user);
		} catch (e) {
			loggerHelper.error(e);
			throw e;
		}
	}

	/**
	 * Get user private packages list
	 * @param {number} id - User ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<[UserPrivatePackageEntity[], number]>}
	 */
	async getUserPrivatePackages(id: number, requestedByUser?: UserEntity | undefined): Promise<[UserPrivatePackageEntity[], number]> {
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: Number(id) } });
		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(UserPrivatePackageEntity);
		return repo.findAndCount({ where: { userId: Number(id) } });
	}

	async getCurrentCheckIn(userId: number, requestedByUser?: UserEntity | undefined): Promise<ReservationEntity[]> {
		
		winstonLogger.info(`getCurrentCheckIn: userId: ${userId}, requestedByUser: ${requestedByUser}`);
		
		const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id: Number(userId) } });
		winstonLogger.info(`getCurrentCheckIn: user: ${user}`);

		if (!user._canView!(requestedByUser)) throw new ForbiddenResponse();

		const reservationRepo = MainDataSource.getRepository(ReservationEntity);
		winstonLogger.info(`getCurrentCheckIn: reservationRepo: ${reservationRepo}`);

		const query = await reservationRepo
			.createQueryBuilder('Reservation')
			.where('Reservation.hoursTo IS NULL')
			.andWhere('Reservation.userId=:userId', { userId })
			.andWhere('Reservation.status = :status', { status: EntityStatus.ACTIVE });

		winstonLogger.info(`getCurrentCheckIn: query: ${query}`);
		return await query.getMany();
	}

	/**
	 * Update USER profile.
	 * @param id
	 * @param data
	 * @param requestedByUser
	 */
	async update(id: number, data: UpdateUserDto, requestedByUser?: UserEntity | undefined) {
		winstonLogger.info(`update: id: ${id}, data: ${data}, requestedByUser: ${requestedByUser}`);
		const oldData = await MainDataSource.getRepository(this.entity).findOneOrFail({ where: { id } });
		if (!oldData._canEdit!(requestedByUser)) throw new ForbiddenResponse();
		let user =  MainDataSource.getRepository(this.entity).save({ ...data, id });
		winstonLogger.info(`update: user: ${user}`);
		if (data.uploadAttachments) {
			try {
				const image64 = await prepareImage(data.uploadAttachments[0], 128);
				const file = await uploadToS3(image64, 'user', String(id), String(new Date().valueOf()));
				await MainDataSource.getRepository(UserEntity).update(id, { photoFileId: file.id });
				user = MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { id } });
			} catch (e) {
				loggerHelper.error('User image saving failed - ', e);
			}
		}
		return user;
	}

	async getPasswordEntry(email: string) {
		const getParams = {
			TableName: 'resetPasswordDb',
			FilterExpression: 'user_email = :email',
			ExpressionAttributeValues: {
				':email': { S: email }
			},
			ProjectionExpression: 'reset_password'
		};
		try {
			winstonLogger.info(`getPasswordEntry: getParams: ${JSON.stringify(getParams)}`);
			const response = await documentClient.send(new ScanCommand(getParams));
			winstonLogger.info(`userService getPasswordEntry: response: ${response}`);
			return response;
		} catch (error) {
			winstonLogger.error(`userService getPasswordEntry: error: ${error}`);
			console.error(error);
		}
    }

	async putPasswordEntry(email: string, password: string) {
		const putParams = {
			Item: {
			  "user_email": email,
			  "reset_password": password,
			},
			TableName: "resetPasswordDb",
		  };

		winstonLogger.info(`dynamo client: ${dynamoClient}`);
		winstonLogger.info(`Document client: ${documentClient}`);  
		try {
			winstonLogger.info(`userService putPasswordEntry: putParams: ${JSON.stringify(putParams)}`);
			const response = await documentClient.send(new PutCommand(putParams));
			winstonLogger.info(`userService putPasswordEntry: response: ${JSON.stringify(response)}`);
			return response;
		} catch (error) {
			winstonLogger.error(`userService putPasswordEntry: error: ${error}`);
			console.error(error);
		}
    }
}
