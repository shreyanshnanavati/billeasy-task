import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * JWT Payload Interface
 * 
 * Defines the structure of the JWT token payload containing user identification
 * and standard JWT claims.
 */
export interface JwtPayload {
  sub: string;    // Subject - User ID as string
  email: string;  // User's email address
  iat?: number;   // Issued at timestamp (optional, added by JWT library)
  exp?: number;   // Expiration timestamp (optional, added by JWT library)
}

/**
 * Login Data Transfer Object
 * 
 * Defines the required fields for user authentication.
 */
export interface LoginDto {
  email: string;    // User's email address
  password: string; // User's plain text password
}

/**
 * Registration Data Transfer Object
 * 
 * Defines the required fields for creating a new user account.
 */
export interface RegisterDto {
  email: string;    // User's email address
  password: string; // User's plain text password (will be hashed)
}

/**
 * Authentication Service
 * 
 * Handles all authentication-related business logic including:
 * - User registration with password hashing
 * - User login with credential validation
 * - JWT token generation and validation
 * - User profile retrieval
 */
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Register New User
   * 
   * Creates a new user account with hashed password and returns JWT token.
   * Validates that email is not already in use.
   * 
   * @param registerDto - User registration data (email, password)
   * @returns Object containing JWT access token and user information
   * @throws ConflictException if user with email already exists
   */
  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    // Check if user already exists to prevent duplicate accounts
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password with salt rounds of 12 for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user record in database
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // Generate JWT token with user identification
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Authenticate User Login
   * 
   * Validates user credentials and returns JWT token upon successful authentication.
   * Uses bcrypt to compare hashed passwords securely.
   * 
   * @param loginDto - User login credentials (email, password)
   * @returns Object containing JWT access token and user information
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email address
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password against stored hash using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token for authenticated user
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Validate JWT Token
   * 
   * Verifies the authenticity and validity of a JWT token.
   * Used by authentication guards to protect routes.
   * 
   * @param token - JWT token string to validate
   * @returns Decoded JWT payload if valid, null if invalid
   */
  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const decoded = this.jwtService.verify(token) as JwtPayload;
      return decoded;
    } catch (error) {
      // Token is invalid, expired, or malformed
      return null;
    }
  }

  /**
   * Get User by ID
   * 
   * Retrieves user information from database by user ID.
   * Returns only safe user data (excludes password).
   * 
   * @param id - User ID as number
   * @returns User object with id, email, and createdAt fields
   */
  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        // Explicitly exclude password field for security
      },
    });
  }
} 