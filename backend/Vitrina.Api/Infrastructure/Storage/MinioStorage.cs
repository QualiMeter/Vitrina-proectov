using Minio;
using Minio.DataModel.Args;
using Microsoft.Extensions.Options;

namespace Vitrina.Api.Infrastructure.Storage;

public sealed class StorageOptions
{
	public string Endpoint { get; set; } = "localhost:9000";
	public string AccessKey { get; set; } = "minio";
	public string SecretKey { get; set; } = "miniosecret";
	public string Bucket { get; set; } = "vitrina";
	public bool UseSsl { get; set; }
	public long MaxFileSizeBytes { get; set; } = 25 * 1024 * 1024;
}

public interface IPrivateObjectStorage
{
	Task PutAsync(string key, Stream content, long size, string contentType, CancellationToken cancellationToken);
	Task<Stream> GetAsync(string key, CancellationToken cancellationToken);
	Task DeleteAsync(string key, CancellationToken cancellationToken);
}

public sealed class MinioPrivateObjectStorage : IPrivateObjectStorage
{
	private readonly IMinioClient _client;
	private readonly StorageOptions _options;
	private static readonly SemaphoreSlim BucketLock = new(1, 1);

	public MinioPrivateObjectStorage(IOptions<StorageOptions> options)
	{
		_options = options.Value;
		_client = new MinioClient()
			.WithEndpoint(_options.Endpoint)
			.WithCredentials(_options.AccessKey, _options.SecretKey)
			.WithSSL(_options.UseSsl)
			.Build();
	}

	public async Task PutAsync(string key, Stream content, long size, string contentType, CancellationToken cancellationToken)
	{
		await BucketLock.WaitAsync(cancellationToken);
		try
		{
			var exists = await _client.BucketExistsAsync(new BucketExistsArgs().WithBucket(_options.Bucket), cancellationToken);
			if (!exists)
				await _client.MakeBucketAsync(new MakeBucketArgs().WithBucket(_options.Bucket), cancellationToken);
		}
		finally
		{
			BucketLock.Release();
		}

		await _client.PutObjectAsync(new PutObjectArgs()
			.WithBucket(_options.Bucket)
			.WithObject(key)
			.WithStreamData(content)
			.WithObjectSize(size)
			.WithContentType(contentType), cancellationToken);

		var stat = await _client.StatObjectAsync(new StatObjectArgs()
			.WithBucket(_options.Bucket)
			.WithObject(key), cancellationToken);
		if (stat.Size != size)
			throw new IOException("MinIO object size verification failed after upload.");
	}

	public async Task<Stream> GetAsync(string key, CancellationToken cancellationToken)
	{
		var output = new MemoryStream();
		await _client.GetObjectAsync(new GetObjectArgs()
			.WithBucket(_options.Bucket)
			.WithObject(key)
			.WithCallbackStream(async stream =>
				await stream.CopyToAsync(output, cancellationToken).ConfigureAwait(false)),
			cancellationToken: cancellationToken);
		output.Position = 0;
		return output;
	}

	public Task DeleteAsync(string key, CancellationToken cancellationToken) =>
		_client.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(_options.Bucket).WithObject(key), cancellationToken);
}
