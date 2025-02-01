import GroupEntity from '@entity/group.entity';
import GroupMemberEntity from '@entity/group-member.entity';
import ApprovalStatus from 'dd-common-blocks/dist/type/ApprovalStatus';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import loggerHelper from '@helpers/logger.helper';
import GroupCompanyCreateWebRequestInterface from 'dd-common-blocks/dist/interface/request/group-company-create-web-request.interface';
import GroupFilter from 'dd-common-blocks/dist/interface/filter/group-filter.interface';
import BaseService from '@services/base.service';
import UserEntity from '@entity/user.entity';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { NotFoundErrorResp } from '@utils/response/not-found.response';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';

/**
 * group service
 */
@Service()
export default class GroupService extends BaseService {
	constructor() {
		super();
		this.entity = GroupEntity;
	}

	/**
	 * Get single group
	 * @param id
	 */
	async single(id: number): Promise<GroupEntity | undefined> {
		return MainDataSource.getRepository(GroupEntity).findOneOrFail({
			where: { id },
			relations: ['photos', 'members', 'createdBy', 'createdBy.photo', 'brand', 'members.member', 'members.member.photo'],
			cache: false,
		});
	}

	/**
	 * Get group list with filter
	 * @param params
	 */
	async list(params: GroupFilter): Promise<[GroupEntity[], number]> {
		const { brandId, venueId, searchString, limit = 10, offset = 0 } = params;

		const query = MainDataSource.getRepository(GroupEntity)
			.createQueryBuilder('Group')
			.leftJoinAndSelect('Group.photos', 'photos')
			.leftJoinAndSelect('Group.brand', 'brand')
			.leftJoinAndSelect('Group.createdBy', 'createdBy')
			.leftJoinAndSelect('Group.members', 'members')
			.where(brandId ? `Group.brandId= :brandId` : '1=1', { brandId })
			.andWhere(venueId ? `Group.venue= :venueId` : '1=1', { venueId })
			.andWhere(searchString ? `LOWER(Group.name) LIKE LOWER(:searchString)` : '1=1', { searchString: `%${searchString}%` })
			.take(limit)
			.skip(offset)
			.cache(false);

		return await query.getManyAndCount();
	}

	/**
	 * Update single group
	 * @param id
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async update(id: number, data: Partial<GroupEntity>, requestedByUser?: UserEntity | undefined): Promise<GroupEntity | undefined> {
		const cloneData = { ...data };
		const group = await MainDataSource.getRepository(GroupEntity).findOneOrFail({ where: { id }, relations: ['photos'] });
		if (!group._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		if (cloneData.uploadAttachments && cloneData.uploadAttachments.length) {
			await Promise.all(
				cloneData.uploadAttachments.map(async (attachment) => {
					try {
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'group', String(id), String(new Date().valueOf()));
						cloneData.photos?.push(file);
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			delete cloneData.uploadAttachments;
		}

		await MainDataSource.getRepository(GroupEntity).save({ ...group, ...cloneData });
		return await this.single(id);
	}

	/**
	 * Create single group
	 * @param data
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async create(data: GroupCompanyCreateWebRequestInterface, requestedByUser?: UserEntity | undefined): Promise<GroupEntity> {
		const { description, name, members, brandId, userId } = data;
		const groupMemberRepo = MainDataSource.getRepository(GroupMemberEntity);

		const attachments = data.uploadAttachments;
		// eslint-disable-next-line no-param-reassign
		delete data.uploadAttachments;

		const group = MainDataSource.getRepository(GroupEntity).create();
		group.description = String(description);
		group.name = name;
		group.brandId = brandId;
		group.createdById = Number(userId);
		const newGroup = await MainDataSource.getRepository(GroupEntity).save(group);

		if (typeof members !== 'undefined') {
			await Promise.all(
				members.map(async (memberId) => {
					const memberData = { userId: Number(memberId), groupId: newGroup.id, createdById: userId };
					const itemsCount = await groupMemberRepo.count({ where: memberData });
					if (itemsCount > 0) return;

					const newMembership = groupMemberRepo.create({ ...memberData, status: ApprovalStatus.APPROVED, dateApproved: new Date() });
					return groupMemberRepo.save(newMembership);
				})
			);
		}

		if (attachments && attachments.length) {
			newGroup.photos = [];
			await Promise.all(
				attachments.map(async (attachment) => {
					try {
						const image64 = await prepareImage(attachment, 1024);
						const file = await uploadToS3(image64, 'group', String(newGroup.id), String(new Date().valueOf()));
						newGroup.photos.push(file);
					} catch (e) {
						loggerHelper.error('image saving failed - ', e);
					}
				})
			);
			await MainDataSource.getRepository(GroupEntity).save(newGroup);
		}

		return newGroup;
	}

	/**
	 * Create single group
	 * @param id
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async delete(id: number, requestedByUser?: UserEntity | undefined): Promise<GroupEntity> {
		const membersRepo = MainDataSource.getRepository(GroupMemberEntity);
		const item = await MainDataSource.getRepository(GroupEntity).findOneOrFail({ where: { id }, relations: ['members'] });
		if (!item._canDelete!(requestedByUser)) throw new ForbiddenResponse();

		// TODO: check cascade
		await Promise.all(
			item.members.map(async (membership) => {
				await membersRepo.remove(membership);
			})
		);

		await MainDataSource.getRepository(GroupEntity).remove(item);
		return item;
	}

	/**
	 * Add group member
	 * @param body
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async addMember(body: Partial<GroupMemberEntity>, requestedByUser?: UserEntity | undefined): Promise<GroupMemberEntity | undefined> {
		const group = await MainDataSource.getRepository(GroupEntity).findOneOrFail({ where: { id: +body.groupId! } });
		if (!group._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(GroupMemberEntity);
		const itemsCount = await repo.count({ where: { userId: body.userId, groupId: body.groupId } });
		if (itemsCount > 0) throw new ForbiddenResponse({ message: 'Already member' });

		const newMembership = repo.create(body);
		return await repo.save(newMembership);
	}

	/**
	 * Delete group member
	 * @param groupId
	 * @param userId
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async deleteMember(groupId: number, userId: number, requestedByUser?: UserEntity | undefined): Promise<GroupMemberEntity> {
		const group = await MainDataSource.getRepository(GroupEntity).findOneOrFail({ where: { id: groupId } });
		if (!group._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(GroupMemberEntity);
		const items = await repo.find({ where: { userId, groupId } });
		if (items.length === 0) throw new NotFoundErrorResp({ message: 'Not found' });

		await repo.delete(items[0].id);
		return items[0];
	}

	/**
	 * Approve group member
	 * @param groupId
	 * @param userId
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async approveMember(groupId: number, userId: number, requestedByUser?: UserEntity | undefined): Promise<GroupMemberEntity> {
		const group = await MainDataSource.getRepository(GroupEntity).findOneOrFail({ where: { id: groupId } });
		if (!group._canEdit!(requestedByUser)) throw new ForbiddenResponse();

		const repo = MainDataSource.getRepository(GroupMemberEntity);
		const item = await repo.findOneOrFail({ where: { userId, groupId } });
		item.status = ApprovalStatus.APPROVED;
		item.dateApproved = new Date();
		return await repo.save(item);
	}
}
