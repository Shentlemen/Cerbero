  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private router: Router,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) { 