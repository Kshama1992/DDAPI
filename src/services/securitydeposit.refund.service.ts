import InvoiceEntity from '@entity/invoice.entity';
import UserEntity from '@entity/user.entity';
import SecurityDepositStatusEntity from '@src/entity/securityDeposit-status.entity';
import { useStripe } from '@helpers/stripe.helper';
import RefundDataEntity from '@entity/refund-data';
import RefundEntity from '@entity/refund.entity';
import { Stripe } from 'stripe';
import PaymentProvider from 'dd-common-blocks/dist/type/PaymentProvider';
import { _calcItemHours } from 'dd-common-blocks/dist/invoice';
import { ForbiddenResponse } from '@utils/response/forbidden.response';
import { Service } from 'typedi';
import MainDataSource from '../main-data-source';
import { NODE_ENV, SERVER_URL } from '@src/config';

/**
 * Handle all actions with invoices.
 * @module Invoice service
 * @category Services
 */
@Service()
export default class SecurityDepositService {

	/**
	 * Update single invoice
	 * @param {string} id - Invoice ID
	 * @param {Partial<InvoiceEntity>} invoiceData - Invoice data to update
	 * @param {UserEntity | undefined} requestedByUser - Requested by user {@link UserEntity}
	 * @return {Promise<InvoiceEntity | undefined>} Returns invoice object or undefined
	 */
	async update(id: number, invoiceData: Partial<InvoiceEntity>, requestedByUser: UserEntity): Promise<InvoiceEntity | undefined> {
		const invoiceRepository = MainDataSource.getRepository(InvoiceEntity);
		const inputInvoiceData = invoiceData;
		const oldInvoiceData = await invoiceRepository.findOneOrFail({
			where: { id },
			relations: [
				'providerData',
				'issuedTo',
				'issuedTo.photo',
				'issuedTo.brand',
				'issuedTo.leadingTeams',
				'issuedTo.leadingTeams.subscriptions',
				'space',
				'space.amenities',
				'space.amenities.amenity',
				'space.photos',
				'space.packageBrands',
				'space.packageVenueTypes',
				'space.packageVenues',
				'space.packageSpaceTypes',
				'space.spaceType',
				'space.creditHours',
				'items',
				'venue',
				'venue.logo',
				'venue.photos',
				'venue.createdBy',
				'invoiceStatus',
				'reservation',
				'subscription',
				'paymentData',
				'providerData',
			],
		});
		console.log('inside invoice.service update ');
		if (!oldInvoiceData._canEdit!(requestedByUser)) 
		{
			throw new ForbiddenResponse();
		}

			const securityDepositStatusList = await MainDataSource.getRepository(SecurityDepositStatusEntity).find();

			const newSecurityDepositStatus = securityDepositStatusList.find((status) => Number(status.id) === Number(inputInvoiceData.invoiceStatusId));

		let { userId } = oldInvoiceData;
		let providerData = oldInvoiceData.providerData[1] ? oldInvoiceData.providerData[1] : oldInvoiceData.providerData[0]

		let refundEntityId: number | undefined = undefined;

		if (
			Number(inputInvoiceData.invoiceStatusId) === Number(oldInvoiceData.invoiceStatusId) ||
			oldInvoiceData.invoiceStatusId === newSecurityDepositStatus?.id ||
			!providerData.providerInvoiceId
		) {
			console.log("Refund can't be processed.", { oldInvoiceData, data: userId });

			throw new ForbiddenResponse({ message: "Refund can't be processed." });
		}

		const invoiceId = oldInvoiceData.id;
		const securityAmount = parseInt(String(invoiceData.refundAmount), 10);
		let invoicePrice = oldInvoiceData.space.securityDepositPrice;
		let refundResponse: Stripe.Response<Stripe.Refund>;

		let provider = PaymentProvider.STRIPE;

		const savePayedInvoice = async () => {
			const refundEntity = MainDataSource.getRepository(RefundEntity).create({
				createdById: requestedByUser.id,
				note: inputInvoiceData.refundNote || '',
				securityAmount,
				returnDate: new Date(),
				userId,
				invoiceId,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			await MainDataSource.getRepository(RefundEntity).manager.connection.transaction(async (refundEntitymanager) => {
				refundEntityId = (await refundEntitymanager.save(refundEntity)).id;
			});

			const refundData = MainDataSource.getRepository(RefundDataEntity).create({
				data: refundResponse,
				userId,
				provider,
				invoiceId,
				refundId: refundEntityId,
				refund: refundResponse && refundResponse.status === 'succeeded',
				securityAmount,
			});

			await MainDataSource.getRepository(RefundDataEntity).manager.connection.transaction(async (refundDataEntitymanager) => {
				await refundDataEntitymanager.save(refundData);
			});

			console.log('Refund data added to the database', { oldInvoiceData, data: userId });

				const refundStatus = securityDepositStatusList.find(
					(s) => s.name === (amount / 100 === Number(invoicePrice) ? 'Full Security Refund' : 'Partial Security Refund')
				);

				if (typeof refundStatus !== 'undefined') inputInvoiceData.invoiceStatusId = refundStatus.id;
			};

		const [stripe] = await useStripe(oldInvoiceData.userId);

		const stripeInvoice = await stripe.invoices.retrieve(providerData.providerInvoiceId);

		userId = oldInvoiceData.userId;

		const amount = securityAmount;
		const refundResult = await stripe.refunds.create({
			charge: stripeInvoice.charge as string,
			amount,
			metadata: {
				reason: 'SecurityRefund',
				invoiceId: oldInvoiceData.id,
				userId: oldInvoiceData.userId,
				reservationId: oldInvoiceData.reservationId,
				env: NODE_ENV,
				serverUrl: SERVER_URL,
			},
		});
		if (refundResult.status !== 'succeeded') {
			console.log('Refund failed', { refundResult, data: userId });

			throw new ForbiddenResponse({ message: 'Refund failed' });
		}

		inputInvoiceData.refund = true;
		await savePayedInvoice();

		delete oldInvoiceData.invoiceStatus;

		oldInvoiceData.updatedById = invoiceData.updatedById || Number(oldInvoiceData.userId);

		const oldItems = inputInvoiceData.items ? inputInvoiceData.items.filter((i) => i.id) : [];
		const newItems = inputInvoiceData.items
			? inputInvoiceData.items
					.filter((i) => typeof i.id === 'undefined')
					.map((i) => {
						const item = { ...i };
						item.quantity = 1;
						item.price2 = i.price || 0;
						item.creditHours = 0;
						item.amenityHoursIncluded = 0;
						item.paid = false;
						item.dateBought = new Date();
						item.createdById = oldInvoiceData.createdById;
						item.updatedById = Number(invoiceData.updatedById);
						return item;
					})
			: [];

		inputInvoiceData.items = oldItems.concat(newItems);

		invoiceRepository.merge(oldInvoiceData, inputInvoiceData);

		await invoiceRepository.save(oldInvoiceData);

		console.log('The refund process has been completed.', { oldInvoiceData, data: userId });

		return oldInvoiceData;
	}
}
