import CompanyEntity from '@entity/company.entity';
import CompanyMemberEntity from '@entity/company-member.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import loggerHelper from '@helpers/logger.helper';
import CompanyFilter from 'dd-common-blocks/dist/interface/filter/company-filter.interface';
import GroupCompanyCreateWebRequestInterface from 'dd-common-blocks/dist/interface/request/group-company-create-web-request.interface';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import UserEntity from '@entity/user.entity';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import { Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import TeamEntity from '@entity/team.entity';
import { Like } from 'typeorm';

/**
 * Handle all actions with Companies.
 * @module CompanyService
 * @category Services
 */
@Service()
export default class CompanyService extends BaseService {
	constructor() {
		super();
		this.entity = CompanyEntity;
	}

	/**
	 * Get single company
	 * @param {string} id
	 * @returns {Promise<CompanyEntity | undefined>}
	 */
	async single(id: number): Promise<CompanyEntity | undefined> {
		return MainDataSource.getRepository(CompanyEntity).findOneOrFail({
			where: { id },
			cache: true,
			relations: ['photos', 'members', 'createdBy', 'createdBy.photo', 'brand', 'members.member', 'members.member.photo'],
		});
	}

	/**
	 * Get company list with filter
	 * @inheritDoc
	 * @param {CompanyFilter} params
	 * @returns {Promise}
	 */
	async list(params: CompanyFilter): Promise<[CompanyEntity[], number]> {
		const { venueId, brandId, searchString, limit = 10, offset = 0 } = params;

		return await MainDataSource.getRepository(CompanyEntity).findAndCount({
			where: { venueId: venueId || undefined, brandId: brandId || undefined, name: searchString ? Like(`%${searchString}%`) : undefined },
			relations: ['photos', 'brand', 'members', 'createdBy'],
			take: limit,
			skip: offset,
		});
	}

	/**
	 * Update single company
	 * @param {number} id - Company ID
	 * @param {Partial<CompanyEntity>} data - HTTP request data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyEntity | undefined>}
	 */
	async update(id: number, data: Partial<CompanyEntity>, requestedByUser?: UserEntity | undefined): Promise<CompanyEntity | undefined> {
		const cloneData = { ...data };
		const company = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({ where: { id }, relations: { photos: true } });

		if (!company._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		// eslint-disable-next-line no-param-reassign
		if (cloneData.services) cloneData.services = `{${cloneData.services.toString()}}`;

		if (cloneData.uploadAttachments && cloneData.uploadAttachments.length) {
			await Promise.all(
				cloneData.uploadAttachments.map(async (attachment) => {
					try {
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'company', String(id), String(new Date().valueOf()));
						cloneData.photos?.push(file);
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			delete cloneData.uploadAttachments;
		}

		await MainDataSource.getRepository(CompanyEntity).save({ ...company, ...cloneData });
		return await this.single(id);
	}

	/**
	 * Create single company
	 * @param {GroupCompanyCreateWebRequestInterface} data - HTTP request data
	 * @returns {Promise<CompanyEntity>}
	 */
	async create(data: GroupCompanyCreateWebRequestInterface): Promise<CompanyEntity> {
		const { description, name, members, brandId, userId } = data;
		const companyMemberRepo = MainDataSource.getRepository(CompanyMemberEntity);

		const attachments = data.uploadAttachments;
		// eslint-disable-next-line no-param-reassign
		delete data.uploadAttachments;

		const company = MainDataSource.getRepository(CompanyEntity).create();
		company.about = String(description);
		company.name = name;
		company.brandId = brandId;
		company.createdById = Number(userId);
		const newCompany = await MainDataSource.getRepository(CompanyEntity).save(company);

		if (typeof members !== 'undefined') {
			await Promise.all(
				members.map(async (memberId: string) => {
					const memberData = { userId: Number(memberId), companyId: newCompany.id, createdById: userId };
					const itemsCount = await companyMemberRepo.count({ where: memberData });
					if (itemsCount > 0) return;

					const newMembership = companyMemberRepo.create({ ...memberData, status: ApprovalStatus.APPROVED, dateApproved: new Date() });
					return companyMemberRepo.save(newMembership);
				})
			);
		}

		if (attachments && attachments.length) {
			newCompany.photos = [];
			await Promise.all(
				attachments.map(async (attachment) => {
					try {
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'company', String(newCompany.id), String(new Date().valueOf()));
						newCompany.photos.push(file);
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			await MainDataSource.getRepository(CompanyEntity).save(newCompany);
		}
		return newCompany;
	}

	/**
	 * Delete single company
	 * @param {number} id - Company ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyEntity>}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<CompanyEntity> {
		const membersRepo = MainDataSource.getRepository(CompanyMemberEntity);
		const item: CompanyEntity = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({
			where: { id },
			relations: { members: true },
		});
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		// TODO: check CASCADE deletion
		await Promise.all(
			item.members.map(async (membership) => {
				await membersRepo.remove(membership);
			})
		);

		return MainDataSource.getRepository(CompanyEntity).remove(item);
	}

	/**
	 * Add company member
	 * @param {Partial<CompanyMemberEntity>} body - member data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyMemberEntity | undefined>}
	 */
	async addMember(body: Partial<CompanyMemberEntity>, requestedByUser?: UserEntity | undefined): Promise<CompanyMemberEntity | undefined> {
		const repo = MainDataSource.getRepository(CompanyMemberEntity);
		const company = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({ where: { id: body.companyId } });
		if (!company._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const itemsCount = await repo.count({ where: { userId: body.userId, companyId: body.companyId } });

		if (itemsCount > 0) throw new ForbiddenResponse({ message: 'Already member' });

		const newMembership = repo.create(body);
		return await repo.save(newMembership);
	}

	/**
	 * Add company team
	 * @param {number} teamId - Team ID
	 * @param {number} companyId - Company ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyEntity | undefined>}
	 */
	async addTeam(companyId: number, teamId: number, requestedByUser?: UserEntity | undefined): Promise<CompanyEntity> {
		const company = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({
			where: { id: companyId },
			relations: { teams: true },
		});
		const findTeam = company.teams.find((t) => t.id === teamId);
		if (!company._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (findTeam) throw new ForbiddenResponse({ message: 'Already have this team' });
		const team = await MainDataSource.getRepository(TeamEntity).findOneOrFail({ where: { id: teamId } });
		company.teams = [...company.teams, team];
		return await MainDataSource.getRepository(CompanyEntity).save(company);
	}

	/**
	 * Delete company member
	 * @param {number} companyId - Company ID
	 * @param {number} userId - Company member user ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyMemberEntity>}
	 */
	async deleteMember(companyId: number, userId: number, requestedByUser?: UserEntity | undefined): Promise<CompanyMemberEntity> {
		const repo = MainDataSource.getRepository(CompanyMemberEntity);
		const company = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({ where: { id: companyId } });
		if (!company._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const items = await repo.find({ where: { userId, companyId } });

		if (items.length === 0) throw new NotFoundErrorResp({ message: 'Not found' });

		await repo.delete(items[0].id);
		return items[0];
	}

	/**
	 * Approve company member
	 * @param {number} companyId - Company ID
	 * @param {number} userId - Company member user ID
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @returns {Promise<CompanyMemberEntity>}
	 */
	async approveMember(companyId: number, userId: number, requestedByUser?: UserEntity | undefined): Promise<CompanyMemberEntity> {
		const company = await MainDataSource.getRepository(CompanyEntity).findOneOrFail({ where: { id: +companyId } });
		if (!company._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(CompanyMemberEntity);
		const item = await repo.findOneOrFail({ where: { userId: +userId, companyId: +companyId } });
		item.status = ApprovalStatus.APPROVED;
		item.dateApproved = new Date();
		return await repo.save(item);
	}
}
