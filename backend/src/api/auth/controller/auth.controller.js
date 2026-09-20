import { StatusCodes } from "http-status-codes";
import { registerService, loginService } from "../service/auth.service.js";

export const registerController = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const newUser = await registerService({
      firstName,
      lastName,
      email,
      password,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "User registered successfully.",
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
};

// *To extract Credentials from req.body

export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const authResult = await loginService({ email, password });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Login successful.",
      user: authResult.user,
      token: authResult.token,
    });
  } catch (error) {
    next(error);
  }
};
