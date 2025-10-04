interface AuthenticatedRequest extends Request {
  cookies: {
    token?: any;
  };
  user?: any;
}

export default AuthenticatedRequest;
