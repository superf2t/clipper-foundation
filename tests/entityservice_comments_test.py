import unittest

import mock

import data
import serviceimpls
from tests import fake_data_layer

class EntityServiceCommentsTest(unittest.TestCase):
    def setUp(self):
        self.email = 'test@test.com'
        self.trip_plan = data.TripPlan(trip_plan_id=11, creator=self.email)
        self.entity = data.Entity(entity_id=222)
        self.trip_plan.entities.append(self.entity)
        fake_data_layer.save_trip_plan(self.trip_plan)

        self.service = serviceimpls.EntityService(data.SessionInfo(email=self.email))

    def request_from_ops(self, *operations):
        return serviceimpls.EntityMutateCommentRequest(operations=operations)

    @mock.patch('serviceimpls.data', new=fake_data_layer)
    def test_single_add(self):
        add_op = serviceimpls.EntityCommentOperation(
            operator=serviceimpls.Operator.ADD.name,
            trip_plan_id=self.trip_plan.trip_plan_id,
            comment=data.Comment(entity_id=self.entity.entity_id, text='Some comment text'))
        request = self.request_from_ops(add_op)
        response = self.service.mutatecomments(request)
        self.assertTrue(response.comments)
        comment = response.comments[0]
        self.assertEqual('Some comment text', comment.text)
        self.assertTrue(comment.comment_id)
        self.assertEqual(self.email, comment.author)
        self.assertTrue(comment.last_modified)

        get_request = serviceimpls.EntityGetRequest(trip_plan_id=self.trip_plan.trip_plan_id)
        get_response = self.service.get(get_request)
        self.assertEqual(1, len(get_response.entities[0].comments))
        saved_comment = get_response.entities[0].comments[0]
        self.assertEqual('Some comment text', saved_comment.text)
        self.assertEqual(comment.comment_id, saved_comment.comment_id)
        self.assertEqual(self.email, saved_comment.author)
        self.assertEqual(comment.last_modified, saved_comment.last_modified)

    @mock.patch('serviceimpls.data', new=fake_data_layer)
    def test_single_edit(self):
        add_op = serviceimpls.EntityCommentOperation(
            operator=serviceimpls.Operator.ADD.name,
            trip_plan_id=self.trip_plan.trip_plan_id,
            comment=data.Comment(entity_id=self.entity.entity_id, text='Some comment text'))
        add_request = self.request_from_ops(add_op)
        add_response = self.service.mutatecomments(add_request)
        original_last_modified = add_response.comments[0].last_modified
        comment_id = add_response.comments[0].comment_id

        edit_op = serviceimpls.EntityCommentOperation(
            operator=serviceimpls.Operator.EDIT.name,
            trip_plan_id=self.trip_plan.trip_plan_id,
            comment=data.Comment(entity_id=self.entity.entity_id,
                comment_id=comment_id,
                text='New comment text'))
        edit_request = self.request_from_ops(edit_op)
        edit_response = self.service.mutatecomments(edit_request)
        comment = edit_response.comments[0]
        self.assertEqual(comment_id, comment.comment_id)
        self.assertNotEqual(original_last_modified, comment.last_modified)
        self.assertEqual('New comment text', comment.text)
        self.assertEqual(self.email, comment.author)

    @mock.patch('serviceimpls.data', new=fake_data_layer)
    def test_single_delete(self):
        add_op = serviceimpls.EntityCommentOperation(
            operator=serviceimpls.Operator.ADD.name,
            trip_plan_id=self.trip_plan.trip_plan_id,
            comment=data.Comment(entity_id=self.entity.entity_id, text='Some comment text'))
        add_request = self.request_from_ops(add_op)
        add_response = self.service.mutatecomments(add_request)
        comment_id = add_response.comments[0].comment_id

        delete_op = serviceimpls.EntityCommentOperation(
            operator=serviceimpls.Operator.DELETE.name,
            trip_plan_id=self.trip_plan.trip_plan_id,
            comment=data.Comment(entity_id=self.entity.entity_id, comment_id=comment_id))
        delete_request = self.request_from_ops(delete_op)
        delete_response = self.service.mutatecomments(delete_request)
        self.assertEqual(1, len(delete_response.comments))
        self.assertEqual(comment_id, delete_response.comments[0].comment_id)

        get_request = serviceimpls.EntityGetRequest(trip_plan_id=self.trip_plan.trip_plan_id)
        get_response = self.service.get(get_request)
        self.assertEqual(0, len(get_response.entities[0].comments))

if __name__ == '__main__':
    unittest.main()
