import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto';
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() d: RegisterDto) { return this.auth.register(d); }
  @Post('login') @HttpCode(200) login(@Body() d: LoginDto) { return this.auth.login(d); }
  @Post('refresh') @HttpCode(200) refresh(@Body() d: RefreshDto) { return this.auth.refresh(d.refreshToken); }
  @Post('logout') @HttpCode(200) logout(@Body() d: RefreshDto) { return this.auth.logout(d.refreshToken); }
}
