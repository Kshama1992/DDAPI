import SpaceEntity from '@entity/space.entity';
import VenueEntity from '@entity/venue.entity';
import PackageShowEntity from '@entity/package-show.entity';
import ReservationEntity from '@entity/reservation.entity';
import SubscriptionEntity from '@entity/subscription.entity';
import UserEntity from '@entity/user.entity';
import InvoiceEntity from '@entity/invoice.entity';
import BrandEntity from '@entity/brand.entity';
import InvoiceItemEntity from '@entity/invoice-item.entity';
import SpaceTypeEntity from '@entity/space-type.entity';
import BillingFilter from 'dd-common-blocks/dist/interface/filter/billing-filter.interface';
import ReportsBillingOutputInterface from 'dd-common-blocks/dist/interface/custom-output/reports-biling-output.interface';
import type SpaceFilterRequest from '@src/dto/space-filter-request';
import ReportsSpacesOutputInterface from 'dd-common-blocks/dist/interface/custom-output/reports-spaces-output.interface';
import ReportsMembersOutputInterface from 'dd-common-blocks/dist/interface/custom-output/reports-members-output.interface';
import VenueFilter from 'dd-common-blocks/dist/interface/filter/venue-filter.interface';
import ReportsVenuesOutputInterface from 'dd-common-blocks/dist/interface/custom-output/reports-venue-output.interface';
import MainDataSource from '@src/main-data-source';

export default class ReportService {
	async formatSpace(): Promise<SpaceEntity[]> {
		const spaces = MainDataSource.getRepository(SpaceEntity)
			.createQueryBuilder('ss')
			.select([
				'ss.id',
				'ss.name',
				'll.name',
				'sst.name',
				'll.currency',
				'ss.quantity',
				'ss.quantityUnlimited',
				'ss.capacity',
				'ss.description',
				'll.currency',
				'ss.price',
				'pps.name',
				'll.id',
				'pmt.name',
				'pct.name',
				'rr',
				'sus.userId',
			])
			.leftJoin(VenueEntity, 'll')
			.leftJoin(SpaceEntity, 'sst')
			.leftJoin(PackageShowEntity, 'pps')
			.leftJoinAndSelect(ReservationEntity, 'rr', 'rr.spaceId = ss.id')
			.leftJoinAndSelect(SubscriptionEntity, 'sus', 'sus.spaceId = ss.id')
			.getRawMany();

		return spaces;
	}

	async billing(params: BillingFilter): Promise<ReportsBillingOutputInterface[]> {
		return MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('ue')
			.select([
				'ue.id',
				'ue.firstname',
				'ue.lastname',
				'ue.phone',
				'ue.brandId',
				'bb.name',
				'ue.locationId',
				'll.name',
				'ue.status',
				'ue.phone',
			])
			.leftJoin(VenueEntity, 'll')
			.leftJoin(BrandEntity, 'bb')
			.leftJoinAndSelect(InvoiceEntity, 'ii', 'ii.issuedTo = ue.id')
			.leftJoinAndSelect(InvoiceItemEntity, 'iie', 'iie.invoiceId = ii.id')
			.innerJoin(SpaceEntity, 'ss', 'ii.spaceId = ss.Id')
			.where('ll.id = :venueId', { venueId: params.venueId })
			.andWhere('ss.id = :spaceId', { spaceId: params.spaceId })
			.andWhere('ue.id = :userId', { userId: params.memberId })
			.andWhere('ii.createdAt >= :startDate', { startDate: params.startDate })
			.andWhere('ii.createdAt <= :endDate', { startDate: params.endDate })
			.andWhere('ii.invoiceNumber = :invoiceNumber', { invoiceNumber: params.invoiceNumber })
			.andWhere('ue.brandId = :brandId', { brandId: params.brandId })
			.getRawMany();
	}

	async spaces(params: SpaceFilterRequest): Promise<ReportsSpacesOutputInterface[]> {
		return MainDataSource.getRepository(SpaceEntity)
			.createQueryBuilder('se')
			.select([
				'se.id',
				'se.name',
				'se.price',
				'se.description',
				'se.quantity',
				'se.quantityUnlimited',
				'se.subscriptionsCount',
				'ste,id',
				'ste.name',
				'cte.id',
				'cte.name',
				'le.id',
				'le.name',
				'le.accessHoursFrom',
				'le.accessHoursTo',
			])
			.leftJoin(SpaceTypeEntity, 'ste')
			.leftJoin(VenueEntity, 'le')
			.leftJoinAndSelect(ReservationEntity, 're', 're.spaceId = se.id')
			.where('ll.id = :venueId', { venueId: params.venueId })
			.andWhere('le.brandid = :brandId', { brandId: params.brandId })
			.getRawMany();
	}

	async members(): Promise<ReportsMembersOutputInterface[]> {
		return MainDataSource.getRepository(UserEntity)
			.createQueryBuilder('t')
			.select(['t1.*'])
			.from((subQuery) => {
				return subQuery
					.select([
						'ue.id',
						'MAX(ue.email)',
						'MAX(ue.phone)',
						'MAX(ue.status)',
						'MAX(ue.hoursUsed)',
						'MAX(ue.hoursLeft)',
						'MAX(ue.hoursFrom)',
						'MAX(ue.hoursTo)',
						'MAX(ue.access247)',
					])
					.addSelect('CONCAT(ue.firstname, ue.lastname)', 'fullname')
					.addSelect('ue.securityDeposite + ue.securityDepositeToRevenue', 'depositManual')
					.addSelect(
						'SUM(CASE WHEN ie.paid AND ie.paidAmount::numeric > 0 THEN ie.paidAmount::numeric - ie.refundedAmount::numeric ELSE ie.refundedAmount::numeric END)',
						'revenue'
					)
					.addSelect('SUM(CASE WHEN ie.paid AND ie.paidAmount::numeric < ... THEN ... ELSE ... END', 'balance')
					.from(UserEntity, 'ue')
					.leftJoinAndSelect(SubscriptionEntity, 'se', 'se.userId = ue.id')
					.leftJoin(InvoiceEntity, 'ie', 'ie.issuedTo = ue.id')
					.groupBy('ue.id');
			}, 't1')
			.innerJoin(UserEntity, 'ue1', 'ue1.id = t1.id')
			.innerJoinAndSelect(InvoiceEntity, 'ie1', 'ue1.id = ie1.issuedTo')
			.getRawMany();
	}

	async venues(params: VenueFilter): Promise<ReportsVenuesOutputInterface[]> {
		return MainDataSource.getRepository(VenueEntity)
			.createQueryBuilder('le')
			.select(['le.id', 'le.name', 'le.country', 'le.state', 'le.city', 'le.currency'])
			.leftJoinAndSelect(SpaceEntity, 'se', 'se.locationId = le.id')
			.leftJoinAndSelect(SpaceTypeEntity, 'ste', 'se.spaceTypeId = ste.id')
			.leftJoinAndSelect(ReservationEntity, 're', 're.spaceId = se.id')
			.leftJoinAndSelect(SubscriptionEntity, 'sube', 'sube.spaceId = se.id')
			.leftJoinAndSelect(InvoiceEntity, 'ie', 'ie.spaceId = se.id')
			.where('le.id = :venueId', { venueId: params.venueId })
			.andWhere('le.brandId = :brandId', { brandId: params.brandId })
			.andWhere('re.bookedAt >= :startDate', { startDate: params.startDate })
			.andWhere('re.bookedAt <= :endDate', { startDate: params.endDate })
			.getRawMany();
	}
}
