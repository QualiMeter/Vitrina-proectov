using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Vitrina.Api.Infrastructure;

public sealed class EmailOptions
{
	public string Host { get; set; } = "";
	public int Port { get; set; } = 587;
	public string UserName { get; set; } = "";
	public string Password { get; set; } = "";
	public string From { get; set; } = "";
	public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
	public bool UseSsl { get; set; }
}

public interface IEmailSender
{
	Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken);
}

public sealed class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
	public async Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken)
	{
		var settings = options.Value;
		if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.From))
			throw new InvalidOperationException("SMTP is not configured. Set Email:Host and Email:From.");

		var message = new MimeMessage();
		message.From.Add(MailboxAddress.Parse(settings.From));
		message.To.Add(MailboxAddress.Parse(recipient));
		message.Subject = subject;
		message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

		using var client = new SmtpClient();
		await client.ConnectAsync(settings.Host, settings.Port,
			settings.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, cancellationToken);

		if (!string.IsNullOrWhiteSpace(settings.UserName))
			await client.AuthenticateAsync(settings.UserName, settings.Password, cancellationToken);

		await client.SendAsync(message, cancellationToken);
		await client.DisconnectAsync(true, cancellationToken);
		logger.LogInformation("Email {Subject} delivered to {Recipient}", subject, recipient);
	}
}
