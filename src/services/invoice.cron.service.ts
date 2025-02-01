import dayjs from 'dayjs';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';
import InvoiceEntity from '@src/entity/invoice.entity';
import { Features } from '@src/utils/features';
import ChargeType from 'dd-common-blocks/dist/type/ChargeType';
import { sendReBookingSMS } from '@src/utils/helpers/sms-helper';
import { FeatureFlag } from '@src/utils/feature-flag';
import ReservationStatus from 'dd-common-blocks/dist/type/ReservationStatus';
import InvoiceService from './invoice.service';
import SpaceTypeLogicType from 'dd-common-blocks/dist/type/SpaceTypeLogicType';
import { ValidationErrorResp } from '@src/utils/response/validation-error.response';
import ReservationEntity from '@src/entity/reservation.entity';
import UserEntity from '@src/entity/user.entity';
import SpaceEntity from '@src/entity/space.entity';
import { sendUserDefinedTemplate } from '@src/utils/helpers/send-mail.helper';
import FileEntity from '@src/entity/file.entity';
import { DOMAIN, MEDIA_URL } from '@src/config';

@Service()
export default class InvoiceCronService {
	features: Features;
	constructor() {
		this.features = new Features();
	}
	/**
	 * Process spaces republish (1 min)
	 * @return {Promise<void>}
	 */
	// async sendBookingReminder(): Promise<void> {
	// 	const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
	// 	const date = new Date();
	// 	date.setHours(date.getHours() - 24);
	// 	const items = await invoiceRepo
	// 		.createQueryBuilder('invoice')
	// 		.select([
	// 			'invoice.id',
	// 			'invoice.createdAt',
	// 			'invoice.userId',
	// 			'invoice.venueId',
	// 			'invoice.spaceId',
	// 			'invoice.subTotal',
	// 			'invoice.currency',
	// 			'invoice.tax',
	// 		])
	// 		.leftJoinAndSelect('invoice.reservation', 'reservation')
	// 		.leftJoinAndSelect('invoice.createdBy', 'createdBy')
	// 		.leftJoinAndSelect('invoice.venue', 'venue')
	// 		.leftJoinAndSelect('invoice.space', 'space')
	// 		.leftJoinAndSelect('invoice.invoiceStatus', 'invoiceStatus')
	// 		.andWhere('reservation.hoursFrom > :date', { date: date.toISOString() })
	// 		 .andWhere('invoice.bookingReminder IS NULL')
	// 		.getMany();

	// 	await Promise.all(
	// 		items.map(async (invoice: InvoiceEntity) => {
	// 			if (invoice.reservation && invoice.space.chargeType !== ChargeType.MONTHLY) {
	// 				const isSendBookingSMSEnabled = await this.features.isEnabled(FeatureFlag.sendBookingSMS);
	// 				if (isSendBookingSMSEnabled && invoice.invoiceStatus?.name === 'Paid') {
	// 					// await sendBookingSMS({
	// 					//     isReminder: true,
	// 					//     venue: invoice.venue,
	// 					//     firstName: invoice.createdBy.firstname,
	// 					//     userPhone: String(invoice.createdBy.phone),
	// 					//     bookedAt: dayjs(invoice.reservation.bookedAt).format('ddd MMM D YYYY'),
	// 					//     bookedForDate: dayjs(invoice.reservation.hoursFrom)
	// 					//                 .format('ddd MMM D YYYY'),
	// 					//     bookedForDay : dayjs(invoice.reservation.hoursFrom)
	// 					//     .format('dddd'),
	// 					//     hoursFrom: invoice.reservation.hoursFrom,
	// 					//     hoursTo: invoice.reservation.hoursTo ?? '',
	// 					//     price: `${Number(invoice.subTotal + invoice.tax).toFixed(2)} ${invoice.currency.toUpperCase()}`,
	// 					//     spaceName: invoice.space.name,
	// 					//     venueAddress: invoice.venue.address,
	// 					//     venuePhone: String(invoice.venue.phone || invoice.venue.createdBy.phone),
	// 					//     venueName: invoice.venue.name,
	// 					//     venueId : invoice.venue.id,
	// 					//     bookingType: invoice.space.chargeType,
	// 					// });
	// 					// invoice.bookingReminder = true;
	// 					// await invoiceRepo.save(invoice);
	// 				}
	// 			}
	// 		})
	// 	);
	// }

	getTime(time: string): string {
		return dayjs(time).format('hh:mm A');
	}

	async sendReBookingReminder(): Promise<void> {
		const invoiceRepo = MainDataSource.getRepository(InvoiceEntity);
		const fromdate = new Date();
		const todate = new Date();
		fromdate.setMinutes(fromdate.getMinutes() + 2);
		todate.setMinutes(todate.getMinutes() + 45);
		const items = await invoiceRepo
			.createQueryBuilder('invoice')
			.select([
				'invoice.id',
				'invoice.createdAt',
				'invoice.userId',
				'invoice.venueId',
				'invoice.spaceId',
				'invoice.subTotal',
				'invoice.currency',
				'invoice.tax',
			])
			.leftJoinAndSelect('invoice.reservation', 'reservation')
			.leftJoinAndSelect('invoice.createdBy', 'createdBy')
			.leftJoinAndSelect('invoice.venue', 'venue')
			.leftJoinAndSelect('venue.accessCustomData', 'accessCustomData')
			.leftJoinAndSelect('invoice.space', 'space')
			.leftJoinAndSelect('invoice.invoiceStatus', 'invoiceStatus')
			.leftJoinAndSelect('space.spaceType', 'spaceType')

			.andWhere('reservation.hoursFrom > :fromdate', { fromdate: fromdate})
			.andWhere('reservation.hoursFrom < :todate', { todate: todate})
			//.andWhere('invoice.reBookingReminder IS NULL')
			.getMany();

		await Promise.all(
			items.map(async (invoice: InvoiceEntity) => {
				if (invoice.reservation && invoice.space.chargeType !== ChargeType.MONTHLY) {
					const isSendBookingSMSEnabled = await this.features.isEnabled(FeatureFlag.sendBookingSMS);
					if (isSendBookingSMSEnabled && invoice.invoiceStatus?.name === 'Paid' && invoice.reservation.status === ReservationStatus.ACTIVE) {
						const isUSA = (invoice.reservation.tzUser || invoice.reservation.tzLocation).indexOf('America') !== -1;
								const timeFormat = isUSA ? 'hh:mm A' : 'HH:mm';
		
								const getReservTime = (time: string) =>
									dayjs(time)
										.tz(invoice.reservation?.tzLocation)
										.format(`D MMMM YYYY ${timeFormat}`);

							await sendReBookingSMS({
							venue: invoice.venue,
							firstName: invoice.createdBy.firstname,
							userPhone: String(invoice.createdBy.phone),
							bookedAt: dayjs(invoice.reservation.bookedAt).format('ddd MMM D YYYY'),
							bookedForDate: dayjs(invoice.reservation.hoursFrom).format('ddd MMM D YYYY'),
							bookedForDay: dayjs(invoice.reservation.hoursFrom).format('dddd'),
							hoursFrom: getReservTime(invoice.reservation.hoursFrom),
							hoursTo: invoice.reservation.hoursTo ? getReservTime(invoice.reservation.hoursTo) : 'In progress',
							price: `${Number(invoice.subTotal + invoice.tax).toFixed(2)} ${invoice.currency.toUpperCase()}`,
							spaceName: invoice.space.name,
							venueAddress: invoice.venue.address,
							venuePhone: String(invoice.venue.phone || invoice.venue.createdBy.phone),
							venueName: invoice.venue.name,
							venueId: invoice.venue.id,
							bookingType: invoice.space.chargeType,
						});
						//await this._sendReminderEmail(invoice);
						invoice.reBookingReminder = true;
						await invoiceRepo.save(invoice);
					}
				}
			})
		);
	}

	async _sendReminderEmail(invoice: any) {
		try {
			console.log('_sendReminderEmail: Sending re-booking reminder email', invoice);
			const invoiceService = new InvoiceService();
			if (
				invoice.space.chargeType !== ChargeType.FREE &&
				invoice.space.spaceType.logicType === SpaceTypeLogicType.MONTHLY &&
				invoice.subTotal < 0.1
			)
				return;

			const user = await MainDataSource.getRepository(UserEntity).createQueryBuilder('User').where('User.id=:userId', { userId: invoice.userId }).getOne();

			if (!user) throw new ValidationErrorResp({ message: 'Wrong user!' });
			console.log('_sendReminderEmail: user', user);

			const messageData: any = {};

			const userTemplateTypeName = 'Re-Booking Reminder';

			if (invoice.spaceId) {
				const space = await MainDataSource.getRepository(SpaceEntity).findOneOrFail({
					where: { id: invoice.spaceId },
					relations: ['spaceType', 'venue', 'venue.brand', 'venue.photos', 'photos'],
				});

				let spaceImage = `https://${DOMAIN}/images/default-image.jpg`;
				let venueImage = `https://${DOMAIN}/images/default-image.jpg`;

				const spacePhotos: FileEntity[] = space.photos;
				if (spacePhotos && spacePhotos.length) {
					spaceImage = `${MEDIA_URL}/434x176${spacePhotos[0].url}`;
				}

				messageData.space = {
					name: space.name,
					logicType: space.spaceType.logicType,
					chargeType: space.chargeType,
					packageShow: space.packageShow,
					image: spaceImage
				};

				const venuePhotos: FileEntity[] = space.venue.photos;
				if (venuePhotos && venuePhotos.length) {
					venueImage = `${MEDIA_URL}/434x176${venuePhotos[0].url}`;
				}

				messageData.venue = space.venue;
				messageData.venue.image = venueImage;

				messageData.brandId = space.venue.brand.id;
				messageData.emailTo = user.email;
				messageData.user = {
					fullname : user.username
				};
				
				console.log('_sendReminderEmail: data', messageData);

				if (invoice.reservation?.id) {
					const resev = await MainDataSource.getRepository(ReservationEntity).findOne({ where: { id: invoice.reservation.id } });

					if (resev) {
						const isUSA = (resev.tzUser || resev.tzLocation).indexOf('America') !== -1;
						const timeFormat = isUSA ? 'hh:mm A' : 'HH:mm';

						const getReservTime = (time: string) =>
							dayjs(time)
								.tz(resev.tzLocation)
								.format(`D MMMM YYYY ${timeFormat}`);

						messageData.reservation = {
							hoursFrom: getReservTime(resev.hoursFrom),
							hoursTo: resev.hoursTo ? getReservTime(resev.hoursTo) : 'In progress',
							bookedAt: dayjs(resev.bookedAt).tz(resev.tzLocation).format('ddd MMM D YYYY'),
							chargeType: resev.chargeType,
							userTz: resev.tzUser || resev.tzLocation,
						};

						console.log('_sendReminderEmail: reservation', messageData.reservation);

					}
				}
			}

			if (
				await invoiceService.sendMembershipEmail(
					userTemplateTypeName,
					messageData.space.logicType,
					messageData.space.packageShow,
					messageData.space.chargeType
				)
			) {
				console.log('_sendReminderEmail: sendMain', userTemplateTypeName);

				return await sendUserDefinedTemplate(userTemplateTypeName, messageData, messageData.space?.logicType);
			}
		} catch (e) {
			console.log('Error in sending re-booking reminder email', e);
		}
	}
}
