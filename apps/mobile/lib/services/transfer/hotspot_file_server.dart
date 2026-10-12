import 'dart:async';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import '../../core/security/crypto_service.dart';

/// Embedded HTTP server for high-speed Hotspot/LAN file transfers.
///
/// Binds to port 9090 when a file transfer is offered, streams the file
/// directly to the PC over Wi-Fi, and automatically terminates once the transfer completes.
class HotspotFileServer {
  HttpServer? _server;
  File? _activeFile;
  String? _expectedToken;
  Completer<void>? _transferCompleter;

  /// Starts the ephemeral server for a specific file.
  ///
  /// Returns the full download URL (e.g. `http://192.168.43.1:9090/download?token=XYZ`).
  Future<String> serveFile({
    required File file,
    String hostIp = '192.168.43.1', // Standard Android Hotspot Gateway IP
    int port = 9090,
  }) async {
    // Terminate any previous server
    await stop();

    _activeFile = file;
    _expectedToken = MobileCryptoService.generateSessionToken();
    _transferCompleter = Completer<void>();

    final router = Router();

    // Streaming download route
    router.get('/download', (Request request) async {
      final token = request.url.queryParameters['token'];

      if (token != _expectedToken) {
        return Response.forbidden('Invalid or expired transfer token.');
      }

      if (_activeFile == null || !await _activeFile!.exists()) {
        return Response.notFound('File no longer available.');
      }

      final fileLength = await _activeFile!.length();
      final stream = _activeFile!.openRead();

      // Signal completion after stream finishes
      Future.delayed(const Duration(milliseconds: 500), () {
        if (_transferCompleter != null && !_transferCompleter!.isCompleted) {
          _transferCompleter!.complete();
        }
      });

      return Response.ok(
        stream,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileLength.toString(),
          'Content-Disposition': 'attachment; filename="${_activeFile!.uri.pathSegments.last}"',
        },
      );
    });

    final handler = const Pipeline()
        .addMiddleware(logRequests())
        .addHandler(router);

    // Bind to all local interfaces (0.0.0.0) so the connected PC can reach it
    _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);

    // Return the reachable URL using the Gateway IP
    return 'http://$hostIp:$port/download?token=$_expectedToken';
  }

  /// Waits until the file transfer finishes streaming.
  Future<void> waitForCompletion({Duration timeout = const Duration(minutes: 5)}) async {
    if (_transferCompleter != null) {
      await _transferCompleter!.future.timeout(timeout);
    }
  }

  /// Stops the server and releases the port.
  Future<void> stop() async {
    if (_server != null) {
      await _server!.close(force: true);
      _server = null;
    }
    _activeFile = null;
    _expectedToken = null;
  }
}
