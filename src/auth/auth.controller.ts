import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Authentication Controller
 * 
 * Handles all authentication-related HTTP endpoints including:
 * - User registration
 * - User login
 * - User profile retrieval
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * User Login Endpoint
   * 
   * Authenticates a user with email and password credentials.
   * Returns a JWT access token and user information upon successful authentication.
   * 
   * @param loginDto - Contains user email and password
   * @returns Object containing access_token and user details
   * @throws UnauthorizedException if credentials are invalid
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * User Registration Endpoint
   * 
   * Creates a new user account with email and password.
   * Automatically logs in the user after successful registration.
   * 
   * @param registerDto - Contains user email and password for new account
   * @returns Object containing access_token and user details
   * @throws ConflictException if user with email already exists
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Get User Profile Endpoint
   * 
   * Protected endpoint that returns the authenticated user's profile information.
   * Requires a valid JWT token in the Authorization header.
   * 
   * @param req - Express request object containing authenticated user info
   * @returns User profile data (id, email, createdAt)
   * @throws UnauthorizedException if JWT token is invalid or missing
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    // Get full user details from database using the user ID from JWT payload
    const user = await this.authService.getUserById(parseInt(req.user.sub));
    return user;
  }
} 