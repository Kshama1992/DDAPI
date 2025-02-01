import axios from 'axios';
import UserEntity from '@entity/user.entity';
import { generateSlug, getMimeFromUrl } from 'dd-common-blocks';
import VenueEntity from '@entity/venue.entity';
import { prepareImage, uploadToS3 } from '@helpers/s3';
import loggerHelper from '@helpers/logger.helper';
import imageToBase64 from '@helpers/image-to-base64.helper';
import MainDataSource from '@src/main-data-source';
import { Service } from 'typedi';

@Service()
export default class ImportService {
	async officefreedomVenue(lastUpdatedHours = 48) {
		const superAdmin = await MainDataSource.getRepository(UserEntity).findOneOrFail({ where: { username: 'Superadmin' } });

		const resp = await axios.get(`https://staging.officefreedom.com/umbraco/surface/salesforce/DropDeskCall?num=${lastUpdatedHours}`);

		return Promise.all(
			resp.data.map(async (inputVenue: any) => {
				const attachments: string[] = [];

				if (inputVenue.imageUrls) {
					await Promise.all(
						inputVenue.imageUrls.map(async (url: string) =>
							attachments.push(`data:${getMimeFromUrl(url)};base64,${await imageToBase64(url)}`)
						)
					);
				}

				const obj = {
					...inputVenue,
					alias: generateSlug(inputVenue.name),
					phone: inputVenue.Phone.replace(/\D+/g, ''),
					createdAt: inputVenue.createdDate,
					updatedAt: inputVenue.modifiedDate,
					coordinates: { coordinates: inputVenue.coordinates, type: 'Point' },
					Phone: undefined,
					createdDate: undefined,
					modifiedDate: undefined,
					attachments,
					photos: [],
					createdById: superAdmin.id,
				};

				const newVenueObj = MainDataSource.getRepository(VenueEntity).create(obj);
				const newVenue = await MainDataSource.getRepository(VenueEntity).save(newVenueObj);

				if (attachments && attachments.length) {
					// @ts-ignore
					newVenue.photos = [];
					await Promise.all(
						attachments.map(async (attachment) => {
							try {
								const image64 = await prepareImage(attachment, 1024);
								// @ts-ignore
								const file = await uploadToS3(image64, 'venue', String(newVenue.id), String(new Date().valueOf()));
								// @ts-ignore
								newVenue.photos.push(file);
							} catch (e) {
								loggerHelper.error('image saving failed - ', e);
							}
						})
					);
				}

				await MainDataSource.getRepository(VenueEntity).save(newVenue);

				return obj;
			})
		);
	}
}
