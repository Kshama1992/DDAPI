import { SuccessResponse } from '@src/utils/response/success.response';
import { JsonController, Res, Get, Authorized } from 'routing-controllers';
import { Service } from 'typedi';


@JsonController('/hello')
@Service()
export class HelloController {

	@Get('/hello-world/')
	@Authorized()
	getHello(@Res() res: Response) {
	
		return new SuccessResponse({ data: { a: 'a'} });
	}
  
	@Get('/hello-limit/')
	getHelloLimit(@Res() res: Response) {
	
		return new SuccessResponse({ data: { a: 'a'} });
	}
  


}
