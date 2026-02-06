"""
Serializers for recruitment app.
"""

from rest_framework import serializers

from .models import (
    Vacancy, Applicant, Interview, InterviewPanel, InterviewFeedback,
    Reference, JobOffer,
    InterviewScoreTemplate, InterviewScoreCategory,
    InterviewScoringSheet, InterviewScoreItem, InterviewReport,
    VacancyURL, VacancyURLView, ApplicantPortalAccess, ApplicantStatusHistory
)


class VacancySerializer(serializers.ModelSerializer):
    """Serializer for Vacancy model."""
    position_name = serializers.CharField(source='position.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True, allow_null=True)
    applicant_count = serializers.SerializerMethodField()

    class Meta:
        model = Vacancy
        fields = '__all__'
        read_only_fields = ['vacancy_number']

    def get_applicant_count(self, obj):
        return obj.applicants.count()


class ApplicantSerializer(serializers.ModelSerializer):
    """Serializer for Applicant model."""
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    full_name = serializers.CharField(read_only=True)
    has_resume = serializers.BooleanField(read_only=True)

    class Meta:
        model = Applicant
        fields = '__all__'
        read_only_fields = ['applicant_number', 'application_date']


class InterviewPanelSerializer(serializers.ModelSerializer):
    """Serializer for InterviewPanel model."""
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)

    class Meta:
        model = InterviewPanel
        fields = '__all__'


class InterviewFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for InterviewFeedback model."""
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)

    class Meta:
        model = InterviewFeedback
        fields = '__all__'


class InterviewSerializer(serializers.ModelSerializer):
    """Serializer for Interview model."""
    applicant_name = serializers.CharField(source='applicant.full_name', read_only=True)
    panel_members = InterviewPanelSerializer(many=True, read_only=True)
    feedback = InterviewFeedbackSerializer(many=True, read_only=True)

    class Meta:
        model = Interview
        fields = '__all__'


class ReferenceSerializer(serializers.ModelSerializer):
    """Serializer for Reference model."""

    class Meta:
        model = Reference
        fields = '__all__'


class JobOfferSerializer(serializers.ModelSerializer):
    """Serializer for JobOffer model."""
    applicant_name = serializers.CharField(source='applicant.full_name', read_only=True)
    position_name = serializers.CharField(source='position.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = JobOffer
        fields = '__all__'
        read_only_fields = ['offer_number']


# Interview Scoring Serializers

class InterviewScoreCategorySerializer(serializers.ModelSerializer):
    """Serializer for InterviewScoreCategory model."""

    class Meta:
        model = InterviewScoreCategory
        fields = '__all__'


class InterviewScoreTemplateSerializer(serializers.ModelSerializer):
    """Serializer for InterviewScoreTemplate model."""
    categories = InterviewScoreCategorySerializer(many=True, read_only=True)
    category_count = serializers.SerializerMethodField()

    class Meta:
        model = InterviewScoreTemplate
        fields = '__all__'

    def get_category_count(self, obj):
        return obj.categories.count()


class InterviewScoreTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating template with categories."""
    categories = InterviewScoreCategorySerializer(many=True, required=False)

    class Meta:
        model = InterviewScoreTemplate
        fields = '__all__'

    def create(self, validated_data):
        categories_data = validated_data.pop('categories', [])
        template = InterviewScoreTemplate.objects.create(**validated_data)

        for idx, category_data in enumerate(categories_data):
            category_data['sort_order'] = idx
            InterviewScoreCategory.objects.create(template=template, **category_data)

        return template


class InterviewScoreItemSerializer(serializers.ModelSerializer):
    """Serializer for InterviewScoreItem model."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_max_score = serializers.IntegerField(source='category.max_score', read_only=True)
    category_weight = serializers.DecimalField(
        source='category.weight', max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = InterviewScoreItem
        fields = '__all__'


class InterviewScoringSheetSerializer(serializers.ModelSerializer):
    """Serializer for InterviewScoringSheet model."""
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    interview_details = serializers.SerializerMethodField()
    scores = InterviewScoreItemSerializer(many=True, read_only=True)

    class Meta:
        model = InterviewScoringSheet
        fields = '__all__'
        read_only_fields = ['total_score', 'weighted_score', 'percentage_score', 'submitted_at']

    def get_interview_details(self, obj):
        return {
            'applicant_name': obj.interview.applicant.full_name,
            'vacancy_title': obj.interview.applicant.vacancy.job_title,
            'interview_type': obj.interview.interview_type,
            'scheduled_date': obj.interview.scheduled_date,
        }


class InterviewScoringSheetCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a scoring sheet with scores."""
    scores = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = InterviewScoringSheet
        fields = [
            'interview', 'template', 'interviewer',
            'strengths', 'weaknesses', 'overall_comments',
            'recommendation', 'recommendation_notes',
            'dvla_license_verified', 'dvla_license_class', 'dvla_expiry_date',
            'driving_test_passed', 'driving_test_score', 'dvla_notes',
            'scores'
        ]

    def create(self, validated_data):
        scores_data = validated_data.pop('scores', [])
        sheet = InterviewScoringSheet.objects.create(**validated_data)

        # Create score items
        for score_data in scores_data:
            InterviewScoreItem.objects.create(
                scoring_sheet=sheet,
                category_id=score_data['category_id'],
                score=score_data.get('score'),
                comments=score_data.get('comments', '')
            )

        # Calculate totals
        sheet.calculate_scores()
        sheet.save()

        return sheet


class InterviewScoringSheetUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a scoring sheet."""
    scores = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = InterviewScoringSheet
        fields = [
            'strengths', 'weaknesses', 'overall_comments',
            'recommendation', 'recommendation_notes',
            'dvla_license_verified', 'dvla_license_class', 'dvla_expiry_date',
            'driving_test_passed', 'driving_test_score', 'dvla_notes',
            'scores'
        ]

    def update(self, instance, validated_data):
        scores_data = validated_data.pop('scores', None)

        # Update sheet fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Update scores if provided
        if scores_data is not None:
            for score_data in scores_data:
                InterviewScoreItem.objects.update_or_create(
                    scoring_sheet=instance,
                    category_id=score_data['category_id'],
                    defaults={
                        'score': score_data.get('score'),
                        'comments': score_data.get('comments', '')
                    }
                )

        # Recalculate totals
        instance.calculate_scores()
        instance.save()

        return instance


class InterviewReportSerializer(serializers.ModelSerializer):
    """Serializer for InterviewReport model."""
    interview_details = serializers.SerializerMethodField()
    decided_by_name = serializers.CharField(
        source='decided_by.get_full_name', read_only=True, allow_null=True
    )

    class Meta:
        model = InterviewReport
        fields = '__all__'

    def get_interview_details(self, obj):
        return {
            'applicant_name': obj.interview.applicant.full_name,
            'vacancy_title': obj.interview.applicant.vacancy.job_title,
            'interview_type': obj.interview.interview_type,
            'scheduled_date': obj.interview.scheduled_date,
            'interview_status': obj.interview.status,
        }


# ========================================
# Vacancy URL Serializers
# ========================================

class VacancyURLSerializer(serializers.ModelSerializer):
    """Full serializer for VacancyURL."""
    vacancy_number = serializers.CharField(source='vacancy.vacancy_number', read_only=True)
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    url_type_display = serializers.CharField(source='get_url_type_display', read_only=True)
    full_url = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = VacancyURL
        fields = [
            'id', 'vacancy', 'vacancy_number', 'vacancy_title',
            'url_type', 'url_type_display', 'url_slug', 'access_token',
            'target_group', 'target_emails',
            'max_uses', 'current_uses', 'last_accessed',
            'expires_at', 'expire_on_hire', 'expire_on_deadline',
            'is_active', 'is_expired', 'notes',
            'view_count', 'application_count',
            'full_url', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'url_slug', 'access_token', 'current_uses', 'last_accessed',
            'view_count', 'application_count', 'created_at', 'updated_at'
        ]


class VacancyURLCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating VacancyURL."""

    class Meta:
        model = VacancyURL
        fields = [
            'vacancy', 'url_type', 'target_group', 'target_emails',
            'max_uses', 'expires_at', 'expire_on_hire', 'expire_on_deadline', 'notes'
        ]

    def validate(self, attrs):
        url_type = attrs.get('url_type', VacancyURL.URLType.PUBLIC)

        # For GROUP type, ensure target emails are provided
        if url_type == VacancyURL.URLType.GROUP:
            if not attrs.get('target_emails') and not attrs.get('target_group'):
                raise serializers.ValidationError({
                    'target_emails': 'Target emails or group required for group-specific URLs'
                })

        return attrs


class VacancyURLListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing VacancyURLs."""
    vacancy_number = serializers.CharField(source='vacancy.vacancy_number', read_only=True)
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    url_type_display = serializers.CharField(source='get_url_type_display', read_only=True)
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = VacancyURL
        fields = [
            'id', 'vacancy', 'vacancy_number', 'vacancy_title',
            'url_type', 'url_type_display', 'url_slug',
            'is_active', 'is_expired', 'view_count', 'application_count',
            'created_at'
        ]


class VacancyURLViewSerializer(serializers.ModelSerializer):
    """Serializer for VacancyURLView tracking."""

    class Meta:
        model = VacancyURLView
        fields = '__all__'
        read_only_fields = ['id', 'vacancy_url', 'viewed_at']


# ========================================
# Applicant Portal Serializers
# ========================================

class ApplicantPortalAccessSerializer(serializers.ModelSerializer):
    """Serializer for ApplicantPortalAccess."""
    applicant_number = serializers.CharField(source='applicant.applicant_number', read_only=True)
    applicant_name = serializers.CharField(source='applicant.full_name', read_only=True)
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = ApplicantPortalAccess
        fields = [
            'id', 'applicant', 'applicant_number', 'applicant_name',
            'email', 'access_token', 'token_expires_at',
            'last_login', 'login_count', 'is_active', 'is_valid'
        ]
        read_only_fields = [
            'id', 'access_token', 'token_expires_at',
            'last_login', 'login_count'
        ]

    def get_is_valid(self, obj):
        return obj.is_valid()


class ApplicantStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for ApplicantStatusHistory."""
    status_display = serializers.SerializerMethodField()
    display_message = serializers.ReadOnlyField()

    class Meta:
        model = ApplicantStatusHistory
        fields = [
            'id', 'applicant', 'old_status', 'new_status', 'status_display',
            'changed_at', 'is_visible_to_applicant', 'display_message'
        ]

    def get_status_display(self, obj):
        status_labels = dict(Applicant.Status.choices)
        return status_labels.get(obj.new_status, obj.new_status)


class ApplicantPortalSerializer(serializers.ModelSerializer):
    """Serializer for applicant's view of their own application."""
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    vacancy_department = serializers.CharField(source='vacancy.department.name', read_only=True)
    vacancy_location = serializers.CharField(source='vacancy.work_location.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_history = serializers.SerializerMethodField()

    class Meta:
        model = Applicant
        fields = [
            'id', 'applicant_number', 'first_name', 'last_name', 'email',
            'vacancy', 'vacancy_title', 'vacancy_department', 'vacancy_location',
            'status', 'status_display', 'application_date',
            'status_history'
        ]

    def get_status_history(self, obj):
        history = obj.status_history.filter(
            is_visible_to_applicant=True
        ).order_by('-changed_at')[:10]
        return ApplicantStatusHistorySerializer(history, many=True).data


class PublicVacancySerializer(serializers.ModelSerializer):
    """Public-facing vacancy serializer for applicant portal."""
    position_name = serializers.CharField(source='position.title', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    location_name = serializers.CharField(source='work_location.name', read_only=True, allow_null=True)

    class Meta:
        model = Vacancy
        fields = [
            'id', 'vacancy_number', 'job_title',
            'position_name', 'department_name', 'location_name',
            'job_description', 'requirements', 'responsibilities',
            'qualifications', 'experience_required', 'skills_required',
            'employment_type', 'closing_date',
            'salary_range_min', 'salary_range_max', 'show_salary'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hide salary if not configured to show
        if not instance.show_salary:
            data.pop('salary_range_min', None)
            data.pop('salary_range_max', None)
        return data


class PublicApplicationSerializer(serializers.ModelSerializer):
    """Serializer for public job applications via vacancy URL."""

    class Meta:
        model = Applicant
        fields = [
            'first_name', 'middle_name', 'last_name',
            'email', 'phone', 'date_of_birth', 'gender', 'nationality',
            'address', 'city', 'region',
            'highest_education', 'institution', 'graduation_year',
            'current_employer', 'current_position', 'years_of_experience',
            'current_salary', 'expected_salary', 'notice_period',
            'cover_letter'
        ]

    def create(self, validated_data):
        import uuid

        # Generate applicant number
        validated_data['applicant_number'] = f"APP-{uuid.uuid4().hex[:8].upper()}"
        validated_data['source'] = Applicant.Source.WEBSITE

        # Set vacancy from context
        vacancy = self.context.get('vacancy')
        if vacancy:
            validated_data['vacancy'] = vacancy

        applicant = super().create(validated_data)

        # Create portal access
        ApplicantPortalAccess.generate_access_token(applicant)

        # Create initial status history
        ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status='',
            new_status=Applicant.Status.NEW,
            is_visible_to_applicant=True,
            public_message='Your application has been received. Thank you for your interest!'
        )

        return applicant


# ========================================
# Shortlisting Serializers
# ========================================

from .models import (
    ShortlistCriteria, ShortlistTemplate, ShortlistTemplateCriteria,
    ShortlistRun, ShortlistResult
)


class ShortlistCriteriaSerializer(serializers.ModelSerializer):
    """Serializer for ShortlistCriteria."""
    criteria_type_display = serializers.CharField(source='get_criteria_type_display', read_only=True)
    match_type_display = serializers.CharField(source='get_match_type_display', read_only=True)

    class Meta:
        model = ShortlistCriteria
        fields = '__all__'


class ShortlistCriteriaCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating shortlist criteria."""

    class Meta:
        model = ShortlistCriteria
        fields = [
            'vacancy', 'criteria_type', 'match_type', 'name', 'description',
            'value_text', 'value_number', 'value_min', 'value_max',
            'weight', 'max_score', 'is_mandatory', 'sort_order'
        ]

    def validate(self, attrs):
        criteria_type = attrs.get('criteria_type')
        match_type = attrs.get('match_type')

        # Validate value fields based on criteria type
        if criteria_type == ShortlistCriteria.CriteriaType.EXPERIENCE:
            if match_type == ShortlistCriteria.MatchType.RANGE:
                if attrs.get('value_min') is None or attrs.get('value_max') is None:
                    raise serializers.ValidationError({
                        'value_min': 'Range criteria require both min and max values'
                    })
            elif attrs.get('value_number') is None:
                raise serializers.ValidationError({
                    'value_number': 'Experience criteria require a numeric value'
                })

        if criteria_type == ShortlistCriteria.CriteriaType.SKILL:
            if not attrs.get('value_text'):
                raise serializers.ValidationError({
                    'value_text': 'Skill criteria require a text value (skill name)'
                })

        return attrs


class ShortlistTemplateCriteriaSerializer(serializers.ModelSerializer):
    """Serializer for template criteria."""

    class Meta:
        model = ShortlistTemplateCriteria
        fields = '__all__'


class ShortlistTemplateSerializer(serializers.ModelSerializer):
    """Serializer for ShortlistTemplate."""
    criteria = ShortlistTemplateCriteriaSerializer(many=True, read_only=True)
    criteria_count = serializers.SerializerMethodField()

    class Meta:
        model = ShortlistTemplate
        fields = '__all__'

    def get_criteria_count(self, obj):
        return obj.criteria.count()


class ShortlistTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating templates with criteria."""
    criteria = ShortlistTemplateCriteriaSerializer(many=True, required=False)

    class Meta:
        model = ShortlistTemplate
        fields = ['code', 'name', 'description', 'job_family', 'is_active', 'criteria']

    def create(self, validated_data):
        criteria_data = validated_data.pop('criteria', [])
        template = ShortlistTemplate.objects.create(**validated_data)

        for idx, crit_data in enumerate(criteria_data):
            crit_data['sort_order'] = idx
            ShortlistTemplateCriteria.objects.create(template=template, **crit_data)

        return template


class ShortlistResultSerializer(serializers.ModelSerializer):
    """Serializer for ShortlistResult."""
    applicant_name = serializers.CharField(source='applicant.full_name', read_only=True)
    applicant_number = serializers.CharField(source='applicant.applicant_number', read_only=True)
    applicant_email = serializers.EmailField(source='applicant.email', read_only=True)
    outcome_display = serializers.CharField(source='get_outcome_display', read_only=True)
    effective_outcome = serializers.ReadOnlyField()

    class Meta:
        model = ShortlistResult
        fields = '__all__'


class ShortlistResultOverrideSerializer(serializers.Serializer):
    """Serializer for overriding shortlist results."""
    override_outcome = serializers.ChoiceField(choices=ShortlistResult.Outcome.choices)
    override_reason = serializers.CharField(required=True)


class ShortlistRunSerializer(serializers.ModelSerializer):
    """Serializer for ShortlistRun."""
    vacancy_number = serializers.CharField(source='vacancy.vacancy_number', read_only=True)
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    run_by_name = serializers.CharField(source='run_by.get_full_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    results = ShortlistResultSerializer(many=True, read_only=True)

    class Meta:
        model = ShortlistRun
        fields = '__all__'
        read_only_fields = [
            'run_number', 'run_date', 'run_by', 'status',
            'total_applicants', 'qualified_count', 'disqualified_count',
            'error_message'
        ]


class ShortlistRunCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a shortlist run."""

    class Meta:
        model = ShortlistRun
        fields = ['vacancy', 'pass_score', 'include_screening_score', 'screening_weight', 'notes']

    def validate_vacancy(self, value):
        # Ensure vacancy has criteria defined
        if not value.shortlist_criteria.exists():
            raise serializers.ValidationError(
                "Vacancy must have shortlisting criteria defined before running"
            )
        return value


class ShortlistRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing runs."""
    vacancy_number = serializers.CharField(source='vacancy.vacancy_number', read_only=True)
    vacancy_title = serializers.CharField(source='vacancy.job_title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ShortlistRun
        fields = [
            'id', 'run_number', 'vacancy', 'vacancy_number', 'vacancy_title',
            'run_date', 'status', 'status_display',
            'total_applicants', 'qualified_count', 'disqualified_count'
        ]


class ApplyTemplateSerializer(serializers.Serializer):
    """Serializer for applying a template to a vacancy."""
    template_id = serializers.IntegerField()
    clear_existing = serializers.BooleanField(default=False)
