class ExpressError extends Error{
    constructor(statusCode,message)
    {
        super(message);
        this.statusCode=statusCode;
        this.massage=message;
    }
}

module.exports=ExpressError;