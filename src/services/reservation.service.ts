import { Brackets, WhereExpression } from 'typeorm';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import ReservationEntity from '@entity/reservation.entity';
import UserEntity from '@entity/user.entity';
import ReservationFilter from 'dd-common-blocks/dist/interface/filter/reservation-filter.interface';
import BaseService from '@services/base.service';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import InvoiceService, { InvoiceEmailTypes } from '@services/invoice.service';
import InvoiceStatusEntity from '@entity/invoice-status.entity';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import { Inject, Service } from 'typedi';
import MainDataSource from '@src/main-data-source';
import UpdateReservationDto from '@src/dto/update-reservation.dto';
import InstantBookingCronService from './instantBooking.cron.service';
import { FeatureFlag } from '@src/utils/feature-flag';
import { Features } from '@src/utils/features';

dayjs.extend(customParseFormat);

/**
 * Handle all actions with Reservations.
 * @module ReservationService
 * @category Services
 */
@Service()
export default class ReservationService extends BaseService {
	@Inject()
	invoiceService: InvoiceService;
	features: Features;

	constructor() {
		super();
		this.entity = ReservationEntity;
		this.features = new Features();
	}

	/**
	 * Get reservations list with filter
	 * @param {ReservationFilter} params - @see ReservationFilter
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 */
	async list(params: ReservationFilter, requestedByUser?: UserEntity | undefined): Promise<[ReservationEntity[], number]> {
		const { venueId, dateFrom, dateTo, hoursFrom, hoursTo, spaceId, brandId, spaceTypeId, limit, offset, searchString, status, teamId } = params;

		let isSuperAdmin = false;
		const adminVenues: number[] = [];
		if (requestedByUser) {
			const user = await MainDataSource.getRepository(UserEntity).findOneOrFail({
				where: { id: requestedByUser.id },
				relations: ['adminVenues'],
			});
			if (user.adminVenues) user.adminVenues.map((v) => adminVenues.push(v.id));
			isSuperAdmin = user.isSuperAdmin();
		}

		let query = MainDataSource.getRepository(ReservationEntity)
			.createQueryBuilder('Reservation')
			.leftJoinAndSelect('Reservation.reservedTo', 'reservedTo')
			.leftJoinAndSelect('Reservation.createdBy', 'createdBy')
			.leftJoinAndSelect('reservedTo.brand', 'brand')
			.leftJoinAndSelect('Reservation.invoice', 'invoice')
			.leftJoinAndSelect('invoice.items', 'items')
			.leftJoinAndSelect('invoice.providerData', 'providerData')
			.leftJoinAndSelect('invoice.subscription', 'subscription')
			.leftJoinAndSelect('invoice.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('Reservation.space', 'space')
			.leftJoinAndSelect('Reservation.venue', 'venue')
			.leftJoinAndSelect('space.eventData', 'eventData')
			.leftJoinAndSelect('space.photos', 'photos')
			.leftJoinAndSelect('venue.photos', 'venuePhotos')
			.leftJoinAndSelect('space.spaceType', 'spaceType')
			.queryAndWhere(
				new Brackets((subQb: WhereExpression) => {
					subQb.where('venue.brandId = :brandId');
					subQb.orWhere('reservedTo.brandId = :brandId');
				}),
				{ brandId }
			)
			.queryAndWhere(`Reservation.spaceId = :spaceId`, { spaceId })
			.queryAndWhere(`Reservation.status = :status`, { status })
			.queryAndWhere(`Reservation.venueId = :venueId`, { venueId })
			.queryAndWhere(`space.spaceTypeId = :spaceTypeId`, { spaceTypeId })
			.queryAndWhere(`Reservation.bookedAt >= :dateFrom`, { dateFrom })
			.queryAndWhere(`Reservation.bookedAt <= :dateTo`, { dateTo })
			.andWhere(hoursFrom ? `Reservation.hoursFrom >= :hoursFrom` : '1=1', { hoursFrom: dayjs(hoursFrom).startOf('day').format() })
			.andWhere(hoursTo ? `Reservation.hoursTo <= :hoursTo` : '1=1', { hoursTo: dayjs(hoursTo).endOf('day').format() });

		if (adminVenues.length) query = query.andWhere('venue.id IN (:...adminVenues)', { adminVenues });

		if (teamId && !isSuperAdmin) {
			query = query.andWhere('invoice.teamId = :teamId', { teamId });
		}

		if (searchString) {
			query = query.andWhere(
				searchString.split(' ').length > 1
					? new Brackets((subQb: WhereExpression) => {
							subQb.where('LOWER(reservedTo.firstname) LIKE LOWER(:fistName)');
							subQb.orWhere('LOWER(reservedTo.lastname) LIKE LOWER(:lastName)');
					  })
					: new Brackets((subQb: WhereExpression) => {
							subQb.where('LOWER(reservedTo.firstname) LIKE LOWER(:searchString)');
							subQb.orWhere('LOWER(reservedTo.lastname) LIKE LOWER(:searchString)');
					  }),
				{
					fistName: `%${searchString.split(' ')[0]}%`,
					lastName: `%${searchString.split(' ')[1]}%`,
					searchString: `%${searchString}%`,
				}
			);
		}

		return query.take(limit).skip(offset).orderBy('Reservation.bookedAt', 'DESC').getManyAndCount();
	}

	/**
	 * Delete reservation
	 * @param {number} id - Reservation ID
	 * @returns {Promise<ReservationEntity>} - Deleted reservation data
	 */
	async delete(id: number): Promise<ReservationEntity> {
		throw new ForbiddenResponse({ message: `Cant delete reservation!` });
	}

	async create(data: Partial<any>, requestedByUser?: UserEntity | undefined): Promise<any> {
		throw new ForbiddenResponse();
	}

	async update(id: number, data: UpdateReservationDto, requestedByUser: UserEntity): Promise<any> {
		const reservation = await MainDataSource.getRepository(ReservationEntity).findOneOrFail({
			where: { id },
			relations: ['invoice', 'invoice.paymentData', 'invoice.reservation'],
		});

		await MainDataSource.getRepository(ReservationEntity).save({ ...reservation, ...data });

		// status changed
		if (data.status && reservation.status !== data.status) {
			if (data.status === ReservationStatus.CANCELED) {
				// cant cancel passed reservation
				if (reservation.status !== ReservationStatus.ACTIVE) throw new ForbiddenResponse({ message: "Can't cancel inactive reservation" });
				if (reservation.hoursTo && dayjs().isAfter(dayjs(reservation.hoursTo)))
					throw new ForbiddenResponse({ message: "Can't cancel passed reservation" });
				if (reservation.invoice!.subscription && reservation.invoice!.subscription.isOngoing)
					throw new ForbiddenResponse({ message: "Can't cancel reservation with not ongoing subscription" });

				const invoiceStatusList = await MainDataSource.getRepository(InvoiceStatusEntity).find();
				const refundStatus = invoiceStatusList.find((is) => is.name.includes('Refunded'));
				if (reservation.invoiceId)	{	
					console.log("inside reservation.service update reservation.invoiceId: "+reservation.invoiceId);	
					if(reservation.invoice?.paid)
						{	
					await this.invoiceService.update(
						reservation.invoiceId,
						{
							refundAmount: (Number(reservation.invoice?.subTotal) + Number(reservation.invoice?.tax)) * 100,
							invoiceStatusId: refundStatus!.id,
						},
						requestedByUser
						);
					}
					else if(await this.features.isEnabled(FeatureFlag.instantlyBookableFeature) && reservation.invoice?.instantlyBookableRequested && !reservation.invoice?.instantlyBookableResponse)
						{
							const instantBookingCronService = new InstantBookingCronService();
							await instantBookingCronService.autoDeclineRequest(reservation.invoice, false)	
						}
				}
			}
		} else if ((data.hoursFrom !== reservation.hoursFrom || data.tzUser !== reservation.tzUser) && reservation.invoiceId) {
			await this.invoiceService._sendEmail(reservation.invoiceId, InvoiceEmailTypes.RESERVATION_CHANGED, { oldReservation: reservation });
		}

		return MainDataSource.getRepository(ReservationEntity).findOneOrFail({
			where: { id: +id },
			relations: [
				'reservedTo',
				'createdBy',
				'reservedTo.brand',
				'invoice',
				'invoice.items',
				'invoice.subscription',
				'invoice.invoiceStatus',
				'invoice.providerData',
				'invoice.venue',
				'invoice.space',
				'invoice.venue.photos',
				'invoice.space.photos',
				'invoice.space.spaceType',
				'invoice.createdBy',
				'space',
				'venue',
				'space.eventData',
				'space.photos',
				'venue.photos',
				'space.spaceType',
			],
		});
	}

	async single(id: number, requestedByUser?: UserEntity | undefined, options?: any): Promise<any> {
		throw new ForbiddenResponse();
	}
}
